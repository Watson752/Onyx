import "server-only";

import type {
  CatalogProduct,
  ExploreResult,
  QuoteApiResult,
  ShipTo,
  SpendingCaps,
} from "./types";

const BASE_URL = "https://api.agnic.ai/api/autofill";
const API_URL = "https://api.agnic.ai/api";
const REQUEST_TIMEOUT_MS = 5 * 60 * 1_000;
// Exceeding this throws a clean, controlled timeout before Vercel Hobby's 60s
// hard kill — an "uncertain" outcome we chose beats one the platform forces.
const DISPATCH_TIMEOUT_MS = 40_000;
const EXPLORE_START_TIMEOUT_MS = 45_000;
const EXPLORE_POLL_TIMEOUT_MS = 30_000;

export const EXPLORE_TERMINAL_ERROR_STATUSES = [
  "merchant_error",
  "worker_error",
  "timeout",
  "payment_gate_hit",
];

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured in .env`);
  return value;
}

export function shippingDestination(): ShipTo {
  const phone = process.env.SHIP_TO_PHONE?.trim();
  return {
    name: requiredEnv("SHIP_TO_NAME"),
    street_address: requiredEnv("SHIP_TO_STREET"),
    address_locality: requiredEnv("SHIP_TO_CITY"),
    address_region: requiredEnv("SHIP_TO_REGION"),
    postal_code: requiredEnv("SHIP_TO_POSTAL"),
    address_country: requiredEnv("SHIP_TO_COUNTRY").toUpperCase(),
    ...(phone ? { phone } : {}),
  };
}

export class AgnicHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Agnic HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

async function agnicRequest(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<unknown> {
  const token = process.env.AGNIC_TOKEN;
  if (!token) throw new Error("AGNIC_TOKEN is not configured in .env");

  const url = endpoint.startsWith("https://") ? endpoint : `${BASE_URL}${endpoint}`;
  console.log("[Agnic request]", {
    method,
    url,
    ...(body === undefined ? {} : { body }),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-Agnic-Token": token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });

    const text = await response.text();
    let responseBody: unknown = null;
    try {
      responseBody = text ? JSON.parse(text) : null;
    } catch {
      responseBody = text;
    }

    console.log("[Agnic response]", {
      method,
      url,
      status: response.status,
      body: responseBody,
    });

    if (!response.ok) {
      throw new AgnicHttpError(response.status, responseBody);
    }
    return responseBody;
  } finally {
    clearTimeout(timeout);
  }
}

export type AgnicResponse = {
  status: number;
  body: JsonRecord;
};

async function agnicResponse(
  method: "GET" | "POST",
  endpoint: string,
  body?: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<AgnicResponse> {
  const token = process.env.AGNIC_TOKEN;
  if (!token) throw new Error("AGNIC_TOKEN is not configured in .env");

  const url = endpoint.startsWith("https://") ? endpoint : `${BASE_URL}${endpoint}`;
  console.log("[Agnic request]", {
    method,
    url,
    ...(body === undefined ? {} : { body }),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-Agnic-Token": token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw_response: text };
    }
    const responseBody = record(parsed);
    console.log("[Agnic response]", {
      method,
      url,
      status: response.status,
      body: responseBody,
    });
    return { status: response.status, body: responseBody };
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchOrder(
  body: Record<string, unknown>,
): Promise<AgnicResponse> {
  return agnicResponse("POST", "/dispatch", body, DISPATCH_TIMEOUT_MS);
}

export async function getOrder(orderId: string): Promise<AgnicResponse> {
  return agnicResponse(
    "GET",
    `/orders/${encodeURIComponent(orderId)}`,
    undefined,
    30_000,
  );
}

export async function getOrderEvidence(
  orderId: string,
): Promise<AgnicResponse> {
  return agnicResponse(
    "GET",
    `/orders/${encodeURIComponent(orderId)}/evidence`,
    undefined,
    30_000,
  );
}

export async function getApprovalStatus(
  approvalToken: string,
): Promise<AgnicResponse> {
  return agnicResponse(
    "GET",
    `${API_URL}/approvals/${encodeURIComponent(approvalToken)}`,
    undefined,
    30_000,
  );
}

function catalogFromExplore(
  body: JsonRecord,
  merchantId: string,
  merchantName: string,
): CatalogProduct[] {
  const discovered = record(body.discovered_items);
  const possibleCatalogs = [
    discovered.catalog,
    body.catalog,
    body.matched_products,
    body.products,
  ];
  const catalog = possibleCatalogs.find(Array.isArray) as unknown[] | undefined;

  return (catalog ?? [])
    .map((raw) => record(raw))
    .filter(
      (item) =>
        typeof item.sku === "string" &&
        typeof (item.price_minor ?? item.priceMinor) === "number",
    )
    .map((item) => {
      const baseTitle =
        typeof item.product_title === "string"
          ? item.product_title
          : typeof item.title === "string"
            ? item.title
            : "Untitled product";
      const variant =
        typeof item.variant_title === "string" &&
        item.variant_title !== "Default Title"
          ? ` — ${item.variant_title}`
          : "";

      return {
        sku: item.sku as string,
        title: `${baseTitle}${variant}`,
        priceMinor: (item.price_minor ?? item.priceMinor) as number,
        currency:
          typeof item.currency === "string"
            ? item.currency
            : typeof discovered.currency === "string"
              ? discovered.currency
              : "CAD",
        available: item.available !== false,
        merchantId,
        merchantName,
        source: "stored" as const,
      };
    });
}

export type ExploreStart = {
  orderId: string | null;
  status: string;
  body: JsonRecord;
};

/**
 * Kicks off an explore run and returns immediately with whatever Agnic gave
 * back (an order id to poll, or an already-"explored" result). This never
 * blocks on the multi-minute crawl itself — callers persist orderId/status
 * and poll `pollExploreOnce` from a separate short-lived request, since a
 * single serverless invocation can't hold a connection open long enough.
 */
export async function startExplore(
  merchantUrl: string,
  goal: string,
): Promise<ExploreStart> {
  const initial = record(
    await agnicRequest(
      "POST",
      "/explore",
      { merchant_url: merchantUrl, goal },
      EXPLORE_START_TIMEOUT_MS,
    ),
  );
  return {
    orderId: typeof initial.order_id === "string" ? initial.order_id : null,
    status: typeof initial.status === "string" ? initial.status : "unknown",
    body: initial,
  };
}

/** One status check against an in-progress explore order. Not a poll loop. */
export async function pollExploreOnce(orderId: string): Promise<JsonRecord> {
  return record(
    await agnicRequest(
      "GET",
      `/orders/${encodeURIComponent(orderId)}`,
      undefined,
      EXPLORE_POLL_TIMEOUT_MS,
    ),
  );
}

export function buildExploreResult(
  merchantUrl: string,
  initial: JsonRecord,
  finalBody: JsonRecord,
): ExploreResult {
  const status =
    typeof finalBody.status === "string" ? finalBody.status : "unknown";
  const discovered = record(finalBody.discovered_items);
  const merchantId = [finalBody.merchant_id, initial.merchant_id, discovered.merchant_id].find(
    (value): value is string => typeof value === "string",
  );
  if (!merchantId) throw new Error("Explore completed without a merchant_id.");

  const host =
    typeof discovered.host === "string"
      ? discovered.host
      : new URL(merchantUrl).hostname;
  const rail =
    typeof discovered.rail === "string"
      ? discovered.rail
      : typeof finalBody.rail === "string"
        ? finalBody.rail
        : null;
  const currency =
    typeof discovered.currency === "string"
      ? discovered.currency
      : typeof finalBody.currency === "string"
        ? finalBody.currency
        : null;

  return {
    merchantId,
    status,
    rail,
    currency,
    name: host,
    products: catalogFromExplore(finalBody, merchantId, host),
    raw: finalBody,
  };
}

export async function searchProducts(
  query: string,
  country = "CA",
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams({ q: query, country });
  const body = record(
    await agnicRequest("GET", `/products/search?${params.toString()}`),
  );
  const products = Array.isArray(body.products) ? body.products : [];

  return products.map((raw) => {
    const product = record(raw);
    const merchant = record(product.merchant);
    const onboard = record(product.onboard);
    return {
      sku: String(product.sku ?? ""),
      title: String(product.title ?? "Untitled product"),
      priceMinor:
        typeof product.price_minor === "number" ? product.price_minor : 0,
      currency:
        typeof product.currency === "string"
          ? product.currency
          : String(body.currency ?? "CAD"),
      available: product.available !== false,
      merchantId:
        typeof merchant.merchant_id === "string"
          ? merchant.merchant_id
          : null,
      merchantName: String(
        merchant.name ?? merchant.domain ?? "Unknown merchant",
      ),
      merchantUrl:
        typeof onboard.merchant_url === "string"
          ? onboard.merchant_url
          : undefined,
      source: "network",
    };
  });
}

export async function quoteSupplier(input: {
  merchantId: string;
  items: Array<{ sku: string; quantity: number }>;
  caps: SpendingCaps;
  fulfillmentOptionId?: string;
  omitShipTo?: boolean;
}): Promise<QuoteApiResult> {
  try {
    const quote = record(
      await agnicRequest("POST", "/shopify/quote", {
        merchant_id: input.merchantId,
        items: input.items,
        ...(input.omitShipTo ? {} : { ship_to: shippingDestination() }),
        ...(input.fulfillmentOptionId
          ? { fulfillment_option_id: input.fulfillmentOptionId }
          : {}),
        constraints: {
          max_total_minor: input.caps.maxTotalMinor,
          max_shipping_minor: input.caps.maxShippingMinor,
        },
      }),
    );
    return { ok: true, quote };
  } catch (error) {
    if (error instanceof AgnicHttpError && error.status === 409) {
      return {
        ok: false,
        status: error.status,
        body: record(error.body),
      };
    }
    throw error;
  }
}
