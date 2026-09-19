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

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function matchScore(query: string, title: string) {
  const queryTokens = tokens(query);
  const titleTokens = new Set(tokens(title));
  if (queryTokens.length === 0) return 0;
  const matches = queryTokens.filter((token) => titleTokens.has(token)).length;
  return matches / queryTokens.length;
}

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
        score: matchScore(item.query, catalogItem.title),
      }))
      .filter(({ catalogItem, score }) => {
        return score > 0 && Boolean(catalogItem.supplier.agnicMerchantId);
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
