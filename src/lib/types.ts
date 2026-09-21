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
  lines?: Array<{
    sku?: string;
    quantity?: number;
    name?: string;
    unit_price_minor?: number;
    line_price_minor?: number;
    available?: boolean;
    [key: string]: unknown;
  }>;
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

export type AddressMode = "ship_to" | "cardholder" | "pickup";

export type ShipTo = {
  name: string;
  street_address: string;
  address_locality: string;
  address_region: string;
  postal_code: string;
  address_country: string;
  phone?: string;
};

export type ApprovedCartSnapshot = {
  merchantId: string;
  supplierName: string;
  items: Array<{ sku: string; quantity: number }>;
  displayItems: Array<{
    title: string;
    query: string;
    sku: string;
    quantity: number;
  }>;
  addressMode: AddressMode;
  shipTo?: ShipTo;
  constraints: {
    max_total_minor: number;
    max_shipping_minor: number;
  };
  amountMinor: number;
  amountIsFinal: boolean;
  currency: string;
  fulfillmentOptionId?: string;
  fulfillmentOption?: {
    type: string;
    title: string;
    description?: string;
  };
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
