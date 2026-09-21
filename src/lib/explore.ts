import "server-only";

import type { Supplier } from "@prisma/client";

import {
  EXPLORE_TERMINAL_ERROR_STATUSES,
  buildExploreResult,
  pollExploreOnce,
  startExplore,
} from "./agnic";
import { preflightSupplier } from "./preflight";
import { prisma } from "./prisma";

const EXPLORE_GOAL = "Buy supplies for a cafe, delivered in Ontario, Canada";

async function finishExplore(
  url: string,
  initial: Record<string, unknown>,
  finalBody: Record<string, unknown>,
) {
  const explored = buildExploreResult(url, initial, finalBody);
  const uniqueProducts = [
    ...new Map(explored.products.map((product) => [product.sku, product])).values(),
  ];

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.upsert({
      where: { url },
      create: {
        url,
        name: explored.name,
        agnicMerchantId: explored.merchantId,
        status: explored.status,
        rail: explored.rail,
        currency: explored.currency,
        exploredAt: new Date(),
        explorePhase: "done",
      },
      update: {
        name: explored.name,
        agnicMerchantId: explored.merchantId,
        status: explored.status,
        rail: explored.rail,
        currency: explored.currency,
        exploredAt: new Date(),
        explorePhase: "done",
        exploreOrderId: null,
        exploreError: null,
      },
    });

    await tx.catalogItem.deleteMany({ where: { supplierId: supplier.id } });
    if (uniqueProducts.length > 0) {
      await tx.catalogItem.createMany({
        data: uniqueProducts.map((product) => ({
          supplierId: supplier.id,
          sku: product.sku,
          title: product.title,
          priceMinor: product.priceMinor,
          currency: product.currency,
        })),
      });
    }

    return supplier;
  });
}

/**
 * One spelling per storefront: lowercase host, no default port, no trailing
 * "/" beyond the root. Pair this with the redirect-resolved URL from
 * preflight — on its own it would still treat www and bare hosts as distinct.
 */
export function canonicalizeSupplierUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.toString();
}

/**
 * Kicks off explore and returns fast (a single POST). The multi-minute crawl
 * itself is never awaited here — the caller's page polls
 * `refreshSupplierExplore` from a separate short-lived request instead of
 * holding this one open, so it survives a 60s serverless function cap.
 */
export async function startSupplierExplore(input: string): Promise<Supplier> {
  // Reject dead domains and non-Shopify storefronts here rather than paying
  // for an explore that can only end in `worker_error`. Throwing keeps the
  // supplier out of the table entirely, so the form shows the reason instead
  // of leaving a permanently-failed row behind.
  const preflight = await preflightSupplier(input);
  if (!preflight.ok) throw new Error(preflight.message);

  // Explore and store the redirect-resolved URL, not what was typed, so
  // "detourcoffee.com" and "www.detourcoffee.com" collapse onto one row via
  // the unique constraint instead of onboarding as two merchants. We follow
  // the site's own redirect rather than stripping "www." by hand, because
  // plenty of hosts (a1cashandcarry.com among them) serve both spellings
  // independently and neither one is wrong.
  const url = canonicalizeSupplierUrl(preflight.canonicalUrl);

  const initial = await startExplore(url, EXPLORE_GOAL);

  if (initial.status === "explored") {
    return finishExplore(url, initial.body, initial.body);
  }

  if (!initial.orderId) {
    throw new Error("Explore did not return an order id to poll.");
  }

  return prisma.supplier.upsert({
    where: { url },
    create: {
      url,
      name: new URL(url).hostname,
      status: "exploring",
      explorePhase: "polling",
      exploreOrderId: initial.orderId,
    },
    update: {
      status: "exploring",
      explorePhase: "polling",
      exploreOrderId: initial.orderId,
      exploreError: null,
    },
  });
}

/** One status check against an in-flight explore. Safe to call repeatedly. */
export async function refreshSupplierExplore(
  supplierId: number,
): Promise<Supplier | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });
  if (!supplier) return null;
  if (supplier.explorePhase !== "polling" || !supplier.exploreOrderId) {
    return supplier;
  }

  const body = await pollExploreOnce(supplier.exploreOrderId);
  const status = typeof body.status === "string" ? body.status : "unknown";

  if (status === "explored") {
    return finishExplore(supplier.url, {}, body);
  }

  if (EXPLORE_TERMINAL_ERROR_STATUSES.includes(status)) {
    return prisma.supplier.update({
      where: { id: supplierId },
      data: {
        status,
        explorePhase: "error",
        exploreError:
          typeof body.error_message === "string"
            ? body.error_message
            : `Explore ended with ${status}.`,
      },
    });
  }

  return supplier;
}
