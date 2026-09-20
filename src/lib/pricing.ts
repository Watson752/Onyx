import "server-only";

import { quoteSupplier } from "./agnic";
import { findCandidates } from "./catalog";
import type { ParsedRequest } from "./schemas";
import { selectCombination } from "./selection";
import type {
  AddressMode,
  AgnicQuote,
  CatalogProduct,
  SpendingCaps,
} from "./types";

export type QuoteOutcome =
  | "ready"
  | "unfulfillable"
  | "cap_breach"
  | "not_ready"
  | "error";

export type SupplierQuoteResult = {
  merchantId: string;
  merchantName: string;
  items: Array<{
    requestItemIndex: number;
    query: string;
    quantity: number;
    sku: string;
    title: string;
    browsePriceMinor: number;
  }>;
  quote: AgnicQuote | null;
  outcome: QuoteOutcome;
  ready: boolean;
  note: string;
  subtotalMinor: number | null;
  shippingMinor: number | null;
  totalMinor: number | null;
  amountIsFinal: boolean;
  currency: string;
  addressMode: AddressMode;
  autoOmittedShipTo: boolean;
  capBreach?: {
    kind: "shipping" | "total";
    limitMinor: number;
    actualMinor: number;
  };
};

export type PricingOptions = {
  omitShipToMerchantIds?: ReadonlySet<string>;
  autoCardholderFallback?: boolean;
};

export type PricingResult = {
  quotes: SupplierQuoteResult[];
  selectedMerchantIds: string[];
  selectedTotalMinor: number | null;
  selectionStrategy: "exact" | "greedy-fallback" | null;
  selectionIncludesCeiling: boolean;
  caps: SpendingCaps;
  missingItems: Array<{ index: number; query: string }>;
  onboardingRequired: Awaited<
    ReturnType<typeof findCandidates>
  >["onboardingRequired"];
};

function selectedShipping(quote: AgnicQuote, subtotal: number | null) {
  const selected = quote.fulfillment_options?.find(
    (option) => option.id === quote.selected_option_id,
  );
  if (selected && Number.isInteger(selected.price_minor)) {
    return selected.price_minor;
  }
  if (
    subtotal !== null &&
    typeof quote.charge_estimate_minor === "number"
  ) {
    return Math.max(0, quote.charge_estimate_minor - subtotal);
  }
  return null;
}

function notReadyReason(quote: AgnicQuote) {
  if (typeof quote.state === "string" && quote.state !== "ready") {
    return `API state is ${quote.state}, not ready.`;
  }
  if (quote.requires_fulfillment_choice) {
    return "A fulfillment option must be chosen; total is not yet comparable.";
  }
  if (!Number.isInteger(quote.expected_amount_minor)) {
    return "Agnic did not return an authoritative amount.";
  }
  return null;
}

function groupCandidateBundles(
  parsed: ParsedRequest,
  candidates: CatalogProduct[],
) {
  const byMerchant = new Map<
    string,
    { merchantName: string; byItem: Map<number, CatalogProduct> }
  >();

  for (const candidate of candidates) {
    if (
      !candidate.merchantId ||
      candidate.requestItemIndex === undefined
    ) {
      continue;
    }
    const group = byMerchant.get(candidate.merchantId) ?? {
      merchantName: candidate.merchantName,
      byItem: new Map<number, CatalogProduct>(),
    };
    const current = group.byItem.get(candidate.requestItemIndex);
    if (!current || candidate.priceMinor < current.priceMinor) {
      group.byItem.set(candidate.requestItemIndex, candidate);
    }
    byMerchant.set(candidate.merchantId, group);
  }

  return [...byMerchant.entries()].map(([merchantId, group]) => ({
    merchantId,
    merchantName: group.merchantName,
    items: [...group.byItem.entries()]
      .sort(([left], [right]) => left - right)
      .map(([requestItemIndex, product]) => ({
        requestItemIndex,
        query: parsed.items[requestItemIndex].query,
        quantity: parsed.items[requestItemIndex].quantity,
        product,
      })),
  }));
}

function displayItems(
  bundle: ReturnType<typeof groupCandidateBundles>[number],
) {
  return bundle.items.map((item) => ({
    requestItemIndex: item.requestItemIndex,
    query: item.query,
    quantity: item.quantity,
    sku: item.product.sku,
    title: item.product.title,
    browsePriceMinor: item.product.priceMinor,
  }));
}

function capRefusal(
  bundle: ReturnType<typeof groupCandidateBundles>[number],
  body: Record<string, unknown>,
  caps: SpendingCaps,
  currency: string,
  addressMode: AddressMode,
  autoOmittedShipTo: boolean,
): SupplierQuoteResult {
  const errorCode = String(body.error ?? body.code ?? "");
  const shipping = errorCode === "constraint_shipping_exceeded";
  const kind = shipping ? "shipping" : "total";
  const limitMinor = shipping
    ? Number(body.max_shipping_minor ?? caps.maxShippingMinor)
    : Number(body.max_total_minor ?? caps.maxTotalMinor);
  const actualMinor = shipping
    ? Number(body.shipping_minor ?? 0)
    : Number(body.expected_amount_minor ?? 0);

  return {
    merchantId: bundle.merchantId,
    merchantName: bundle.merchantName,
    items: displayItems(bundle),
    quote: null,
    outcome: "cap_breach",
    ready: false,
    note: `Supplier skipped: ${kind} exceeds the configured limit; nothing charged.`,
    subtotalMinor: null,
    shippingMinor: shipping ? actualMinor : null,
    totalMinor: shipping ? null : actualMinor,
    amountIsFinal: false,
    currency: String(body.currency ?? currency),
    addressMode,
    autoOmittedShipTo,
    capBreach: { kind, limitMinor, actualMinor },
  };
}

function isNoLocalFulfilment(quote: AgnicQuote) {
  const reason = String(
    quote.unfulfillable?.reason ?? quote.error ?? quote.state ?? "",
  )
    .toLowerCase()
    .replaceAll("-", "_");
  return (
    reason === "no_local_fulfilment" ||
    reason === "no_local_fulfillment"
  );
}

export async function priceRequest(
  parsed: ParsedRequest,
  caps: SpendingCaps,
  options: PricingOptions = {},
): Promise<PricingResult> {
  const discovery = await findCandidates(parsed);
  const bundles = groupCandidateBundles(parsed, discovery.candidates);
  const candidateIndexes = new Set(
    discovery.candidates
      .map((candidate) => candidate.requestItemIndex)
      .filter((index): index is number => index !== undefined),
  );
  const missingItems = parsed.items
    .map((item, index) => ({ index, query: item.query }))
    .filter(({ index }) => !candidateIndexes.has(index));

  const quotes: SupplierQuoteResult[] = [];
  for (const bundle of bundles) {
    let usedOmitShipTo =
      options.omitShipToMerchantIds?.has(bundle.merchantId) ?? false;
    let autoOmittedShipTo = false;
    try {
      let response = await quoteSupplier({
        merchantId: bundle.merchantId,
        caps,
        omitShipTo: usedOmitShipTo,
        items: bundle.items.map((item) => ({
          sku: item.product.sku,
          quantity: item.quantity,
        })),
      });

      if (
        response.ok &&
        !usedOmitShipTo &&
        options.autoCardholderFallback !== false &&
        isNoLocalFulfilment(response.quote)
      ) {
        usedOmitShipTo = true;
        autoOmittedShipTo = true;
        response = await quoteSupplier({
          merchantId: bundle.merchantId,
          caps,
          omitShipTo: true,
          items: bundle.items.map((item) => ({
            sku: item.product.sku,
            quantity: item.quantity,
          })),
        });
      }

      const soleOption =
        response.ok && response.quote.fulfillment_options?.length === 1
          ? response.quote.fulfillment_options[0]
          : undefined;
      if (
        response.ok &&
        usedOmitShipTo &&
        soleOption?.type === "pickup" &&
        response.quote.selected_option_id !== soleOption.id
      ) {
        response = await quoteSupplier({
          merchantId: bundle.merchantId,
          caps,
          omitShipTo: true,
          fulfillmentOptionId: soleOption.id,
          items: bundle.items.map((item) => ({
            sku: item.product.sku,
            quantity: item.quantity,
          })),
        });
      }

      if (!response.ok) {
        const errorCode = String(
          response.body.error ?? response.body.code ?? "",
        );
        if (
          errorCode === "constraint_shipping_exceeded" ||
          errorCode === "constraint_total_exceeded"
        ) {
          quotes.push(
            capRefusal(
              bundle,
              response.body,
              caps,
              parsed.currency,
              usedOmitShipTo ? "cardholder" : "ship_to",
              autoOmittedShipTo,
            ),
          );
        } else {
          throw new Error(
            `Agnic HTTP ${response.status}: ${JSON.stringify(response.body)}`,
          );
        }
        continue;
      }

      const quote = response.quote;
      const selectedOption = quote.fulfillment_options?.find(
        (option) => option.id === quote.selected_option_id,
      );
      const pickupWithShipTo =
        selectedOption?.type === "pickup" && !usedOmitShipTo;
      const addressMode: AddressMode =
        selectedOption?.type === "pickup" && usedOmitShipTo
          ? "pickup"
          : usedOmitShipTo
            ? "cardholder"
            : "ship_to";
      const subtotal =
        typeof quote.subtotal_minor === "number"
          ? quote.subtotal_minor
          : bundle.items.reduce(
              (sum, item) =>
                sum + item.product.priceMinor * item.quantity,
              0,
            );
      const total =
        typeof quote.expected_amount_minor === "number"
          ? quote.expected_amount_minor
          : null;

      if (quote.unfulfillable) {
        quotes.push({
          merchantId: bundle.merchantId,
          merchantName: bundle.merchantName,
          items: displayItems(bundle),
          quote,
          outcome: "unfulfillable",
          ready: false,
          note: `Cannot fulfill using ${
            addressMode === "ship_to"
              ? "the configured ship_to address"
              : addressMode === "cardholder"
                ? "the cardholder address"
                : "pickup"
          }: ${
            quote.unfulfillable.reason ?? "merchant returned unfulfillable"
          }. Nothing charged.`,
          subtotalMinor: subtotal,
          shippingMinor: null,
          totalMinor: null,
          amountIsFinal: false,
          currency: quote.currency ?? parsed.currency,
          addressMode,
          autoOmittedShipTo,
        });
        continue;
      }

      const readinessNote = pickupWithShipTo
        ? "Pickup cannot be combined with ship_to. Omit ship_to and quote again."
        : notReadyReason(quote);
      quotes.push({
        merchantId: bundle.merchantId,
        merchantName: bundle.merchantName,
        items: displayItems(bundle),
        quote,
        outcome: readinessNote ? "not_ready" : "ready",
        ready: readinessNote === null,
        note:
          readinessNote ??
          (quote.amount_is_final
            ? "Ready: authoritative tax-inclusive amount."
            : "Ready: amount is a ceiling; tax may be added at checkout."),
        subtotalMinor: subtotal,
        shippingMinor: selectedShipping(quote, subtotal),
        totalMinor: total,
        amountIsFinal: quote.amount_is_final === true,
        currency: quote.currency ?? parsed.currency,
        addressMode,
        autoOmittedShipTo,
      });
    } catch (error) {
      quotes.push({
        merchantId: bundle.merchantId,
        merchantName: bundle.merchantName,
        items: displayItems(bundle),
        quote: null,
        outcome: "error",
        ready: false,
        note: error instanceof Error ? error.message : String(error),
        subtotalMinor: null,
        shippingMinor: null,
        totalMinor: null,
        amountIsFinal: false,
        currency: parsed.currency,
        addressMode: usedOmitShipTo ? "cardholder" : "ship_to",
        autoOmittedShipTo,
      });
    }
  }

  const selection = selectCombination(
    quotes,
    parsed.items.length,
    parsed.budget_minor,
  );

  return {
    quotes,
    selectedMerchantIds: selection?.merchantIds ?? [],
    selectedTotalMinor: selection?.totalMinor ?? null,
    selectionStrategy: selection?.strategy ?? null,
    selectionIncludesCeiling: selection?.includesCeiling ?? false,
    caps,
    missingItems,
    onboardingRequired: discovery.onboardingRequired,
  };
}
