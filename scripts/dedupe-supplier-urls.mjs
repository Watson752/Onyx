/**
 * One-off backfill for suppliers onboarded before startSupplierExplore
 * canonicalized its URL. Resolves each stored URL through the site's own
 * redirect, collapses rows that land on the same canonical spelling (keeping
 * the best-populated one), and rewrites the survivor's url in place.
 *
 * Dry run by default; pass --apply to write.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

function canonicalize(rawUrl) {
  const parsed = new URL(rawUrl);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
}

async function resolve(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/125.0 Safari/537.36" },
    });
    return canonicalize(response.url || url);
  } catch {
    return canonicalize(url); // Unreachable host: normalize spelling only.
  }
}

const suppliers = await prisma.supplier.findMany({
  include: { _count: { select: { catalogItems: true } } },
  orderBy: { id: "asc" },
});

const groups = new Map();
for (const supplier of suppliers) {
  const canonical = await resolve(supplier.url);
  if (!groups.has(canonical)) groups.set(canonical, []);
  groups.get(canonical).push(supplier);
}

const renames = [];
const deletions = [];

for (const [canonical, rows] of groups) {
  // Prefer the row already stored under the canonical spelling: its
  // agnicMerchantId is the merchant Agnic returns for that host, so keeping a
  // "www." twin would strand us on a merchant id future explores never yield.
  // Then prefer a finished explore, a richer catalog, and finally the newest.
  const ranked = [...rows].sort(
    (a, b) =>
      Number(canonicalize(b.url) === canonical) - Number(canonicalize(a.url) === canonical) ||
      Number(b.explorePhase === "done") - Number(a.explorePhase === "done") ||
      b._count.catalogItems - a._count.catalogItems ||
      b.id - a.id,
  );
  const [keeper, ...losers] = ranked;
  for (const loser of losers) {
    deletions.push({ id: loser.id, url: loser.url, items: loser._count.catalogItems });
  }
  if (keeper.url !== canonical) renames.push({ id: keeper.id, from: keeper.url, to: canonical });
}

console.log(`\n${APPLY ? "APPLYING" : "DRY RUN"} — ${suppliers.length} suppliers, ${groups.size} distinct storefronts\n`);
for (const d of deletions) console.log(`  DELETE  #${d.id} ${d.url}  (${d.items} catalog items)`);
for (const r of renames) console.log(`  RENAME  #${r.id} ${r.from}\n               -> ${r.to}`);
if (!deletions.length && !renames.length) console.log("  nothing to do");

if (APPLY) {
  await prisma.$transaction(async (tx) => {
    // Delete losers first so a rename can't collide with a row about to go.
    if (deletions.length) {
      await tx.supplier.deleteMany({ where: { id: { in: deletions.map((d) => d.id) } } });
    }
    for (const r of renames) {
      await tx.supplier.update({ where: { id: r.id }, data: { url: r.to } });
    }
  });
  console.log("\nApplied.");
}

await prisma.$disconnect();
