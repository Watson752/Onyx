import "server-only";

import type {
  CatalogProduct,
  ExploreResult,
  QuoteApiResult,
  SpendingCaps,
} from "./types";

const BASE_URL = "https://api.agnic.ai/api/autofill";
const REQUEST_TIMEOUT_MS = 5 * 60 * 1_000;
const EXPLORE_POLL_MS = 5_000;
const EXPLORE_DEADLINE_MS = 5 * 60 * 1_000;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured in .env`);
  return value;
}

function shippingDestination() {
  return {
    name: requiredEnv("SHIP_TO_NAME"),
    street_address: requiredEnv("SHIP_TO_STREET"),
    address_locality: requiredEnv("SHIP_TO_CITY"),
    address_region: requiredEnv("SHIP_TO_REGION"),
    postal_code: requiredEnv("SHIP_TO_POSTAL"),
    address_country: requiredEnv("SHIP_TO_COUNTRY").toUpperCase(),
  };
}

class AgnicHttpError extends Error {
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
): Promise<unknown> {
  const token = process.env.AGNIC_TOKEN;
  if (!token) throw new Error("AGNIC_TOKEN is not configured in .env");

  const url = `${BASE_URL}${endpoint}`;
  console.log("[Agnic request]", {
    method,
    url,
    ...(body === undefined ? {} : { body }),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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

export async function exploreSupplier(
  merchantUrl: string,
  goal: string,
): Promise<ExploreResult> {
  const initial = record(
    await agnicRequest("POST", "/explore", {
      merchant_url: merchantUrl,
      goal,
    }),
  );

  const orderId =
    typeof initial.order_id === "string" ? initial.order_id : undefined;
  let finalBody = initial;
  let status = typeof initial.status === "string" ? initial.status : "unknown";

  if (orderId && status !== "explored") {
    const deadline = Date.now() + EXPLORE_DEADLINE_MS;
    while (Date.now() < deadline) {
      await sleep(EXPLORE_POLL_MS);
      finalBody = record(
        await agnicRequest("GET", `/orders/${encodeURIComponent(orderId)}`),
      );
      status =
        typeof finalBody.status === "string" ? finalBody.status : "unknown";
      if (status === "explored") break;
      if (
        [
          "merchant_error",
          "worker_error",
          "timeout",
          "payment_gate_hit",
        ].includes(status)
      ) {
        throw new Error(
          `Explore ended with ${status}: ${String(finalBody.error_message ?? "")}`,
        );
      }
    }
    if (status !== "explored") {
      throw new Error("Explore did not complete within five minutes.");
    }
  }

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
}): Promise<QuoteApiResult> {
  try {
    const quote = record(
      await agnicRequest("POST", "/shopify/quote", {
        merchant_id: input.merchantId,
        items: input.items,
        ship_to: shippingDestination(),
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
