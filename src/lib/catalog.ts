import "server-only";

import { prisma } from "./prisma";
import { searchProducts } from "./agnic";
import type { ParsedRequest } from "./schemas";
import type { CatalogProduct } from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "of",
  "the",
  "to",
  "with",
]);

/**
 * Crude English singularizer. Product titles and request text disagree on
 * number constantly ("2 bags of beans" vs "Whole Bean"), and an exact-token
 * match treats those as unrelated, so both sides get folded to singular
 * before comparison.
 */
function singularize(token: string) {
  if (token.length <= 3) return token;
  if (token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (/(?:s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2);
  if (token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
    .map(singularize);
}

/**
 * The storefront's own name, as one squashed lowercase blob: "detourcoffee".
 * Hostnames run words together, so this is matched by substring rather than
 * by token.
 */
function merchantBlob(supplierName: string) {
  return supplierName
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** A supplier-name hit is worth half a title hit — see `matchScore`. */
const MERCHANT_TOKEN_CREDIT = 0.5;
/** Shortest token allowed to match a merchant blob, so "co" can't match everything. */
const MIN_MERCHANT_TOKEN = 4;

/**
 * Fraction of the query explained by this product, where a word found in the
 * title counts fully and a word found only in the storefront's name counts
 * half.
 *
 * The category word is often absent from the title — Detour's beans are
 * "Detour Dark — 300g / Whole Bean", with "coffee" appearing only in
 * "detourcoffee.com" — so without the merchant as context "coffee beans"
 * scores higher against *instant* coffee than against actual beans. Half
 * credit is what keeps that context from taking over: it can lift a product
 * whose title already supplies the distinctive word ("bean"), but a bare
 * "coffee" against that merchant's gift card still lands under the floor.
 */
function matchScore(query: string, title: string, supplierName: string) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return 0;

  const titleTokens = new Set(tokens(title));
  const blob = merchantBlob(supplierName);

  const earned = queryTokens.reduce((total, token) => {
    if (titleTokens.has(token)) return total + 1;
    if (token.length >= MIN_MERCHANT_TOKEN && blob.includes(token)) {
      return total + MERCHANT_TOKEN_CREDIT;
    }
    return total;
  }, 0);

  return earned / queryTokens.length;
}

/**
 * A single matching word out of two or three used to be enough to quote a
 * product, which is how "oat milk" reached dairy milk and "compostable cups"
 * reached a $3,069 case of ice cream cups. Requiring most of the query to
 * land sends a genuine miss to the network search instead of quoting
 * something the buyer plainly did not ask for.
 */
const MIN_MATCH_SCORE = 0.6;

export type CandidateDiscovery = {
  candidates: CatalogProduct[];
  onboardingRequired: Array<{
    requestItemIndex: number;
    merchantName: string;
    merchantUrl?: string;
    title: string;
  }>;
};

export async function findCandidates(
  parsed: ParsedRequest,
): Promise<CandidateDiscovery> {
  const storedItems = await prisma.catalogItem.findMany({
    include: { supplier: true },
  });
  const candidates: CatalogProduct[] = [];
  const onboardingRequired: CandidateDiscovery["onboardingRequired"] = [];

  for (const [requestItemIndex, item] of parsed.items.entries()) {
    const local = storedItems
      .map((catalogItem) => ({
        catalogItem,
        score: matchScore(
          item.query,
          catalogItem.title,
          catalogItem.supplier.name,
        ),
      }))
      .filter(({ catalogItem, score }) => {
        return (
          score >= MIN_MATCH_SCORE && Boolean(catalogItem.supplier.agnicMerchantId)
        );
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.catalogItem.priceMinor - b.catalogItem.priceMinor,
      )
      .slice(0, 6)
      .map(({ catalogItem }) => ({
        sku: catalogItem.sku,
        title: catalogItem.title,
        priceMinor: catalogItem.priceMinor,
        currency: catalogItem.currency,
        available: true,
        merchantId: catalogItem.supplier.agnicMerchantId,
        merchantName: catalogItem.supplier.name,
        merchantUrl: catalogItem.supplier.url,
        source: "stored" as const,
        requestItemIndex,
      }));

    candidates.push(...local);

    if (local.length === 0) {
      const network = (await searchProducts(item.query, "CA"))
        .filter((product) => product.available)
        .sort((a, b) => a.priceMinor - b.priceMinor);

      for (const product of network.filter((entry) => entry.merchantId).slice(0, 4)) {
        candidates.push({ ...product, requestItemIndex });
      }

      for (const product of network.filter((entry) => !entry.merchantId).slice(0, 3)) {
        onboardingRequired.push({
          requestItemIndex,
          merchantName: product.merchantName,
          merchantUrl: product.merchantUrl,
          title: product.title,
        });
      }
    }
  }

  return { candidates, onboardingRequired };
}
