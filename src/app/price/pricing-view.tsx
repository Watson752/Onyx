import Link from "next/link";

import { Money, formatMoney } from "@/components/money";
import type { ParsedRequest } from "@/lib/schemas";
import type { PricingResult } from "@/lib/pricing";

export function PricingView({
  requestId,
  parsed,
  result,
}: {
  requestId: number;
  parsed: ParsedRequest;
  result: PricingResult;
}) {
  const selected = new Set(result.selectedMerchantIds);
  const approvalParams = new URLSearchParams({
    maxTotalMinor: String(result.caps.maxTotalMinor),
    maxShippingMinor: String(result.caps.maxShippingMinor),
    addressModeSet: "1",
  });
  for (const quote of result.quotes) {
    if (quote.addressMode !== "ship_to") {
      approvalParams.append("omitShipTo", quote.merchantId);
    }
  }

  return (
    <div className="space-y-8">
      <section
        className={`rounded-lg border p-5 ${
          result.selectedTotalMinor === null
            ? "border-amber-300 bg-amber-50"
            : "border-emerald-300 bg-emerald-50"
        }`}
      >
        <h2 className="text-xl font-bold">
          {result.selectionStrategy === null
            ? "No complete combination"
            : result.selectionStrategy === "greedy-fallback"
            ? "Greedy fallback combination"
            : "Cheapest exact-cover combination"}
        </h2>
        {result.selectedTotalMinor === null ? (
          <p className="mt-2">
            No ready, non-overlapping supplier set covers every item within{" "}
            {formatMoney(parsed.budget_minor, parsed.currency)}.
          </p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-black">
              <Money
                amountMinor={result.selectedTotalMinor}
                currency={parsed.currency}
              />
            </p>
            <p className="text-sm">
              Across {result.selectedMerchantIds.length} supplier cart(s), under
              a budget of {formatMoney(parsed.budget_minor, parsed.currency)}.{" "}
              Selection uses delivered quote amounts, not browse-time unit
              prices.
            </p>
            {result.selectionStrategy === "greedy-fallback" ? (
              <p className="mt-2 text-sm font-semibold text-amber-900">
                Exact cover was unavailable; the page stayed usable by falling
                back to greedy selection.
              </p>
            ) : null}
            {result.selectionIncludesCeiling ? (
              <p className="mt-2 rounded bg-amber-100 p-2 text-sm text-amber-900">
                This comparison includes at least one ceiling, not a final
                total. Tax may be added at checkout.
              </p>
            ) : null}
            <Link
              href={`/approve/${requestId}?${approvalParams.toString()}`}
              className="mt-4 inline-block rounded bg-zinc-950 px-4 py-2 font-semibold text-white"
            >
              Review exact approval
            </Link>
          </>
        )}
        <p className="mt-3 text-xs text-zinc-600">
          Caps: total{" "}
          {formatMoney(result.caps.maxTotalMinor, parsed.currency)}; shipping{" "}
          {formatMoney(result.caps.maxShippingMinor, parsed.currency)}.
        </p>
      </section>

      {result.missingItems.length > 0 ? (
        <section className="rounded-lg border border-red-300 bg-red-50 p-5">
          <h2 className="font-bold">No supplier candidate found</h2>
          <ul className="mt-2 list-disc pl-5">
            {result.missingItems.map((item) => (
              <li key={item.index}>{item.query}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.onboardingRequired.length > 0 ? (
        <details className="rounded-lg border bg-white p-5">
          <summary className="cursor-pointer font-bold">
            Network matches requiring Explore (
            {result.onboardingRequired.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {result.onboardingRequired.map((item, index) => (
              <li key={`${item.merchantName}-${index}`}>
                <strong>{parsed.items[item.requestItemIndex].query}:</strong>{" "}
                {item.title} at {item.merchantName}
                {item.merchantUrl ? ` — ${item.merchantUrl}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <form method="get" className="space-y-5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="addressModeSet" value="1" />
        <input
          type="hidden"
          name="maxTotalDollars"
          value={(result.caps.maxTotalMinor / 100).toFixed(2)}
        />
        <input
          type="hidden"
          name="maxShippingDollars"
          value={(result.caps.maxShippingMinor / 100).toFixed(2)}
        />
        <h2 className="text-2xl font-black">Supplier quotes</h2>
        {result.quotes.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-zinc-500">
            There were no onboarded candidate suppliers to quote.
          </p>
        ) : (
          result.quotes.map((supplierQuote) => {
            const isSelected = selected.has(supplierQuote.merchantId);
            const fulfillmentOptions =
              supplierQuote.quote?.fulfillment_options ?? [];
            const onlyPickup =
              fulfillmentOptions.length > 0 &&
              fulfillmentOptions.every((option) => option.type === "pickup");
            return (
              <article
                key={supplierQuote.merchantId}
                className={`overflow-hidden rounded-lg border-2 bg-white ${
                  isSelected
                    ? "border-emerald-500"
                    : supplierQuote.outcome === "cap_breach"
                      ? "border-amber-400"
                      : supplierQuote.outcome === "unfulfillable"
                        ? "border-zinc-400"
                    : "border-transparent ring-1 ring-zinc-200"
                }`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 bg-zinc-100 p-4">
                  <div>
                    <h3 className="font-bold">{supplierQuote.merchantName}</h3>
                    <p className="font-mono text-xs text-zinc-500">
                      {supplierQuote.merchantId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {isSelected ? (
                      <span className="rounded bg-emerald-700 px-2 py-1 text-xs font-bold text-white">
                        CHEAPEST SET
                      </span>
                    ) : null}
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${
                        supplierQuote.ready
                          ? "bg-green-100 text-green-800"
                          : supplierQuote.outcome === "error"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {supplierQuote.ready
                        ? "READY"
                        : supplierQuote.outcome === "cap_breach"
                          ? "CAP REFUSAL"
                          : supplierQuote.outcome === "unfulfillable"
                            ? "CANNOT DELIVER"
                            : "NOT READY"}
                    </span>
                  </div>
                </header>

                <div className="space-y-3 border-b p-4">
                  <p className="text-sm">
                    <strong>Address used:</strong>{" "}
                    {supplierQuote.addressMode === "ship_to"
                      ? "configured cafe ship_to address"
                      : supplierQuote.addressMode === "cardholder"
                        ? "cardholder saved address (ship_to omitted)"
                        : "none — pickup"}
                  </p>
                  {supplierQuote.addressMode === "pickup" ? (
                    <input
                      type="hidden"
                      name="omitShipTo"
                      value={supplierQuote.merchantId}
                    />
                  ) : (
                    <label className="flex items-start gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        name="omitShipTo"
                        value={supplierQuote.merchantId}
                        defaultChecked={
                          supplierQuote.addressMode === "cardholder"
                        }
                        className="mt-1"
                      />
                      <span>
                        Ship to cardholder address (omit ship_to)
                        {supplierQuote.autoOmittedShipTo ? (
                          <span className="block font-normal text-amber-800">
                            Defaulted on because the ship_to quote returned
                            no_local_fulfilment.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )}
                  {onlyPickup ? (
                    <p className="rounded bg-blue-50 p-2 text-sm font-semibold text-blue-950">
                      Pickup only. No delivery address is sent, and pickup
                      cannot be combined with ship_to.
                    </p>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Requested</th>
                        <th className="p-3">Matched item</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Browse price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierQuote.items.map((item) => (
                        <tr key={`${item.requestItemIndex}-${item.sku}`} className="border-b">
                          <td className="p-3">{item.query}</td>
                          <td className="p-3">{item.title}</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">
                            <Money
                              amountMinor={item.browsePriceMinor}
                              currency={supplierQuote.currency}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-semibold">
                      <tr>
                        <td colSpan={3} className="p-3 text-right">
                          Subtotal
                        </td>
                        <td className="p-3">
                          <Money
                            amountMinor={supplierQuote.subtotalMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="p-3 text-right">
                          Shipping
                        </td>
                        <td className="p-3">
                          <Money
                            amountMinor={supplierQuote.shippingMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                      <tr className="text-base">
                        <td colSpan={3} className="p-3 text-right">
                          {supplierQuote.amountIsFinal
                            ? "Tax-inclusive total"
                            : "Charge ceiling"}
                        </td>
                        <td className="p-3">
                          <Money
                            amountMinor={supplierQuote.totalMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="border-t p-4">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
                    Available fulfilment options
                  </h4>
                  {fulfillmentOptions.length === 0 ? (
                    <p className="mt-1 text-sm text-zinc-600">
                      The merchant returned no fulfilment options.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm">
                      {fulfillmentOptions.map((option) => (
                        <li
                          key={option.id}
                          className="rounded border border-zinc-200 p-2"
                        >
                          <strong>{option.title}</strong> ({option.type}) —{" "}
                          {formatMoney(option.price_minor, option.currency)}
                          {option.id ===
                          supplierQuote.quote?.selected_option_id ? (
                            <span className="ml-2 rounded bg-zinc-900 px-2 py-0.5 text-xs font-bold text-white">
                              SELECTED
                            </span>
                          ) : null}
                          {option.description ? (
                            <span className="block text-zinc-600">
                              {option.description}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {supplierQuote.capBreach ? (
                  <p className="border-t bg-amber-50 p-3 text-sm text-amber-950">
                    {supplierQuote.merchantName} skipped:{" "}
                    {supplierQuote.capBreach.kind}{" "}
                    {formatMoney(
                      supplierQuote.capBreach.actualMinor,
                      supplierQuote.currency,
                    )}{" "}
                    exceeds your{" "}
                    {formatMoney(
                      supplierQuote.capBreach.limitMinor,
                      supplierQuote.currency,
                    )}{" "}
                    limit; nothing charged.
                  </p>
                ) : (
                  <p className="border-t p-3 text-sm text-zinc-600">
                    {supplierQuote.note}
                  </p>
                )}
              </article>
            );
          })
        )}
        {result.quotes.length > 0 ? (
          <button
            type="submit"
            className="rounded bg-zinc-950 px-4 py-2 font-semibold text-white"
          >
            Requote address modes
          </button>
        ) : null}
      </form>
    </div>
  );
}
