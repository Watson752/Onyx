import "server-only";

import { quoteSupplier, shippingDestination } from "./agnic";
import {
  priceRequest,
  type PricingOptions,
  type SupplierQuoteResult,
} from "./pricing";
import type { ParsedRequest } from "./schemas";
import type {
  ApprovedCartSnapshot,
  AgnicQuote,
  SpendingCaps,
} from "./types";

function authoritativeAmount(quote: AgnicQuote) {
  if (
    quote.requires_fulfillment_choice ||
    !Number.isInteger(quote.expected_amount_minor)
  ) {
    throw new Error("The supplier no longer has an approvable delivered amount.");
  }
  return quote.expected_amount_minor as number;
}

async function requoteForApproval(
  supplier: SupplierQuoteResult,
  caps: SpendingCaps,
) {
  const response = await quoteSupplier({
    merchantId: supplier.merchantId,
    items: supplier.items.map(({ sku, quantity }) => ({ sku, quantity })),
    caps,
    omitShipTo: supplier.addressMode !== "ship_to",
    fulfillmentOptionId:
      typeof supplier.quote?.selected_option_id === "string"
        ? supplier.quote.selected_option_id
        : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `${supplier.merchantName} refused the approval preview: ${JSON.stringify(response.body)}`,
    );
  }
  if (response.quote.unfulfillable) {
    throw new Error(
      `${supplier.merchantName} can no longer fulfill this basket.`,
    );
  }
  authoritativeAmount(response.quote);
  return response.quote;
}

export async function prepareApprovalCarts(
  parsed: ParsedRequest,
  initialCaps: SpendingCaps,
  pricingOptions: PricingOptions = {},
): Promise<ApprovedCartSnapshot[]> {
  const pricing = await priceRequest(parsed, initialCaps, pricingOptions);
  const selected = new Set(pricing.selectedMerchantIds);
  const suppliers = pricing.quotes.filter((quote) => selected.has(quote.merchantId));

  if (suppliers.length === 0 || pricing.selectedTotalMinor === null) {
    throw new Error("There is no complete supplier basket ready for approval.");
  }

  const carts: ApprovedCartSnapshot[] = [];
  for (const supplier of suppliers) {
    if (!supplier.ready || supplier.totalMinor === null || !supplier.quote) {
      throw new Error(`${supplier.merchantName} is no longer ready for approval.`);
    }

    let maxTotalMinor = supplier.amountIsFinal
      ? supplier.totalMinor
      : Math.ceil(supplier.totalMinor * 1.2);
    let constraints = {
      maxTotalMinor,
      maxShippingMinor: initialCaps.maxShippingMinor,
    };
    let quote = await requoteForApproval(supplier, constraints);
    let amountMinor = authoritativeAmount(quote);

    if (!quote.amount_is_final) {
      const requiredHeadroom = Math.ceil(amountMinor * 1.2);
      if (requiredHeadroom !== maxTotalMinor) {
        maxTotalMinor = requiredHeadroom;
        constraints = { ...constraints, maxTotalMinor };
        quote = await requoteForApproval(supplier, constraints);
        amountMinor = authoritativeAmount(quote);
        if (maxTotalMinor < Math.ceil(amountMinor * 1.2)) {
          throw new Error(
            `${supplier.merchantName}'s ceiling changed while preparing approval. Reload to quote again.`,
          );
        }
      }
    }

    const selectedOption = quote.fulfillment_options?.find(
      (option) => option.id === quote.selected_option_id,
    );
    if (
      (supplier.addressMode === "pickup" &&
        selectedOption?.type !== "pickup") ||
      (supplier.addressMode === "ship_to" &&
        selectedOption?.type === "pickup")
    ) {
      throw new Error(
        `${supplier.merchantName}'s fulfilment/address mode changed while preparing approval.`,
      );
    }
    const addressMode =
      selectedOption?.type === "pickup" ? "pickup" : supplier.addressMode;

    carts.push({
      merchantId: supplier.merchantId,
      supplierName: supplier.merchantName,
      items: supplier.items.map(({ sku, quantity }) => ({ sku, quantity })),
      displayItems: supplier.items.map(
        ({ title, query, sku, quantity }) => ({ title, query, sku, quantity }),
      ),
      addressMode,
      ...(addressMode === "ship_to"
        ? { shipTo: shippingDestination() }
        : {}),
      constraints: {
        max_total_minor: constraints.maxTotalMinor,
        max_shipping_minor: constraints.maxShippingMinor,
      },
      amountMinor,
      amountIsFinal: quote.amount_is_final === true,
      currency: quote.currency ?? supplier.currency,
      fulfillmentOptionId:
        typeof quote.selected_option_id === "string"
          ? quote.selected_option_id
          : undefined,
      ...(selectedOption
        ? {
            fulfillmentOption: {
              type: selectedOption.type,
              title: selectedOption.title,
              ...(selectedOption.description
                ? { description: selectedOption.description }
                : {}),
            },
          }
        : {}),
    });
  }

  return carts;
}
