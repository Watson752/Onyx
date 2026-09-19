import type { ParsedRequest } from "./schemas";

export type CatalogProduct = {
  sku: string;
  title: string;
  priceMinor: number;
  currency: string;
  available: boolean;
  merchantId: string | null;
  merchantName: string;
  merchantUrl?: string;
  source: "stored" | "network";
  requestItemIndex?: number;
};

export type ExploreResult = {
  merchantId: string;
  status: string;
  rail: string | null;
  currency: string | null;
  name: string;
  products: CatalogProduct[];
  raw: unknown;
};

export type AgnicQuote = {
  state?: string;
  rail?: string;
  fulfillment_options?: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    price_minor: number;
    currency: string;
    requires_address?: boolean;
    eta?: string;
  }>;
  requires_fulfillment_choice?: boolean;
  selected_option_id?: string | null;
  expected_amount_minor?: number | null;
  amount_is_final?: boolean;
  subtotal_minor?: number | null;
  charge_estimate_minor?: number | null;
  charge_cap_minor?: number | null;
  currency?: string;
  lines?: unknown[];
  unfulfillable?: { reason?: string };
  error?: string;
  error_description?: string;
  message?: string;
  [key: string]: unknown;
};

export type SpendingCaps = {
  maxTotalMinor: number;
  maxShippingMinor: number;
};

export type QuoteApiResult =
  | { ok: true; quote: AgnicQuote }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
    };

export type RequestWithParsed = {
  id: number;
  rawText: string;
  budgetMinor: number;
  createdAt: Date;
  parsed: ParsedRequest;
};
