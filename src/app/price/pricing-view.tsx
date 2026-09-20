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
    <div className="space-y-14">
      {/* Hero: the chosen basket. */}
      <section
        className={`rounded-3xl border p-10 sm:p-12 ${
          result.selectedTotalMinor === null
            ? "border-amberwarm/30 bg-amberwarm-soft"
            : "border-sage/30 bg-sage-soft"
        }`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Chosen basket
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl">
          {result.selectionStrategy === null
            ? "No complete combination"
            : result.selectionStrategy === "greedy-fallback"
            ? "Greedy fallback combination"
            : "Cheapest exact-cover combination"}
        </h2>
        {result.selectedTotalMinor === null ? (
          <p className="mt-5 max-w-2xl text-espresso-soft">
            No ready, non-overlapping supplier set covers every item within{" "}
            {formatMoney(parsed.budget_minor, parsed.currency)}.
          </p>
        ) : (
          <>
            <p className="mt-8 font-display text-6xl font-semibold tabular-nums tracking-tight text-espresso sm:text-7xl">
              <Money
                amountMinor={result.selectedTotalMinor}
                currency={parsed.currency}
              />
            </p>
            <p className="mt-5 max-w-2xl text-espresso-soft">
              Across {result.selectedMerchantIds.length} supplier cart(s), under
              a budget of {formatMoney(parsed.budget_minor, parsed.currency)}.{" "}
              Selection uses delivered quote amounts, not browse-time unit
              prices.
            </p>
            {result.selectionStrategy === "greedy-fallback" ? (
              <p className="mt-5 max-w-2xl rounded-xl bg-amberwarm-soft px-5 py-4 text-sm text-amberwarm-deep">
                Exact cover was unavailable; the page stayed usable by falling
                back to greedy selection.
              </p>
            ) : null}
            {result.selectionIncludesCeiling ? (
              <p className="mt-4 max-w-2xl rounded-xl bg-amberwarm-soft px-5 py-4 text-sm text-amberwarm-deep">
                This comparison includes at least one ceiling, not a final
                total. Tax may be added at checkout.
              </p>
            ) : null}
            <Link
              href={`/approve/${requestId}?${approvalParams.toString()}`}
              className="mt-9 inline-block rounded-full bg-terracotta px-8 py-4 text-sm font-medium tracking-wide text-bone hover:bg-terracotta-deep"
            >
              Review exact approval
            </Link>
          </>
        )}
        <p className="mt-8 border-t border-espresso/10 pt-5 text-xs tabular-nums text-espresso-soft">
          Caps: total{" "}
          {formatMoney(result.caps.maxTotalMinor, parsed.currency)}; shipping{" "}
          {formatMoney(result.caps.maxShippingMinor, parsed.currency)}.
        </p>
      </section>

      {result.missingItems.length > 0 ? (
        <section className="rounded-2xl border border-brick/25 bg-brick-soft p-8">
          <h2 className="font-display text-xl font-semibold text-espresso">
            No supplier candidate found
          </h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-espresso-soft">
            {result.missingItems.map((item) => (
              <li key={item.index}>{item.query}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.onboardingRequired.length > 0 ? (
        <details className="rounded-2xl border border-line bg-cream p-8">
          <summary className="cursor-pointer font-display text-xl font-semibold text-espresso hover:text-terracotta">
            Network matches requiring Explore (
            {result.onboardingRequired.length})
          </summary>
          <ul className="mt-5 space-y-3 border-t border-line pt-5 text-sm text-espresso-soft">
            {result.onboardingRequired.map((item, index) => (
              <li key={`${item.merchantName}-${index}`}>
                <strong className="font-medium text-espresso">
                  {parsed.items[item.requestItemIndex].query}:
                </strong>{" "}
                {item.title} at {item.merchantName}
                {item.merchantUrl ? ` — ${item.merchantUrl}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <form method="get" className="space-y-8">
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
        <h2 className="font-display text-3xl font-semibold tracking-tight text-espresso">
          Supplier quotes
        </h2>
        {result.quotes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-cream p-10 text-center text-espresso-faint">
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
                className={`overflow-hidden rounded-2xl border bg-cream ${
                  isSelected
                    ? "border-sage ring-1 ring-sage/40"
                    : supplierQuote.outcome === "cap_breach"
                      ? "border-amberwarm/40"
                      : supplierQuote.outcome === "unfulfillable"
                        ? "border-line-strong"
                    : "border-line"
                }`}
              >
                <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-beige px-8 py-6">
                  <div>
                    <h3 className="font-display text-xl font-semibold tracking-tight text-espresso">
                      {supplierQuote.merchantName}
                    </h3>
                    <p className="mt-1 font-mono text-xs text-espresso-faint">
                      {supplierQuote.merchantId}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSelected ? (
                      <span className="inline-flex items-center rounded-full bg-sage px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-bone">
                        Cheapest set
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        supplierQuote.ready
                          ? "bg-sage-soft text-sage-deep"
                          : supplierQuote.outcome === "error"
                            ? "bg-brick-soft text-brick"
                            : "bg-amberwarm-soft text-amberwarm-deep"
                      }`}
                    >
                      {supplierQuote.ready
                        ? "Ready"
                        : supplierQuote.outcome === "cap_breach"
                          ? "Cap refusal"
                          : supplierQuote.outcome === "unfulfillable"
                            ? "Cannot deliver"
                            : "Not ready"}
                    </span>
                  </div>
                </header>

                <div className="space-y-4 border-b border-line px-8 py-6">
                  <p className="text-sm text-espresso-soft">
                    <strong className="font-medium text-espresso">
                      Address used:
                    </strong>{" "}
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
                    <label className="flex items-start gap-3 text-sm text-espresso">
                      <input
                        type="checkbox"
                        name="omitShipTo"
                        value={supplierQuote.merchantId}
                        defaultChecked={
                          supplierQuote.addressMode === "cardholder"
                        }
                        className="mt-1 size-4 accent-terracotta"
                      />
                      <span>
                        Ship to cardholder address (omit ship_to)
                        {supplierQuote.autoOmittedShipTo ? (
                          <span className="block text-amberwarm-deep">
                            Defaulted on because the ship_to quote returned
                            no_local_fulfilment.
                          </span>
                        ) : null}
                      </span>
                    </label>
                  )}
                  {onlyPickup ? (
                    <p className="rounded-xl bg-beige-deep px-5 py-4 text-sm text-espresso-soft">
                      Pickup only. No delivery address is sent, and pickup
                      cannot be combined with ship_to.
                    </p>
                  ) : null}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-[0.16em] text-espresso-faint">
                        <th className="px-8 py-4 font-semibold">Requested</th>
                        <th className="px-8 py-4 font-semibold">
                          Matched item
                        </th>
                        <th className="px-8 py-4 text-right font-semibold">
                          Qty
                        </th>
                        <th className="px-8 py-4 text-right font-semibold">
                          Browse price
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierQuote.items.map((item) => (
                        <tr
                          key={`${item.requestItemIndex}-${item.sku}`}
                          className="border-b border-line"
                        >
                          <td className="px-8 py-5 text-espresso-soft">
                            {item.query}
                          </td>
                          <td className="px-8 py-5 text-espresso">
                            {item.title}
                          </td>
                          <td className="px-8 py-5 text-right tabular-nums text-espresso-soft">
                            {item.quantity}
                          </td>
                          <td className="px-8 py-5 text-right tabular-nums text-espresso">
                            <Money
                              amountMinor={item.browsePriceMinor}
                              currency={supplierQuote.currency}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="text-espresso">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-8 pt-5 pb-2 text-right text-espresso-soft"
                        >
                          Subtotal
                        </td>
                        <td className="px-8 pt-5 pb-2 text-right tabular-nums">
                          <Money
                            amountMinor={supplierQuote.subtotalMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="px-8 py-2 text-right text-espresso-soft"
                        >
                          Shipping
                        </td>
                        <td className="px-8 py-2 text-right tabular-nums">
                          <Money
                            amountMinor={supplierQuote.shippingMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                      <tr>
                        <td
                          colSpan={3}
                          className="px-8 pt-2 pb-6 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint"
                        >
                          {supplierQuote.amountIsFinal
                            ? "Tax-inclusive total"
                            : "Charge ceiling"}
                        </td>
                        <td className="px-8 pt-2 pb-6 text-right font-display text-2xl font-semibold tabular-nums">
                          <Money
                            amountMinor={supplierQuote.totalMinor}
                            currency={supplierQuote.currency}
                          />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="border-t border-line px-8 py-6">
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                    Available fulfilment options
                  </h4>
                  {fulfillmentOptions.length === 0 ? (
                    <p className="mt-2 text-sm text-espresso-soft">
                      The merchant returned no fulfilment options.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3 text-sm">
                      {fulfillmentOptions.map((option) => (
                        <li
                          key={option.id}
                          className="rounded-xl border border-line bg-bone px-5 py-4 text-espresso-soft"
                        >
                          <strong className="font-medium text-espresso">
                            {option.title}
                          </strong>{" "}
                          ({option.type}) —{" "}
                          <span className="tabular-nums">
                            {formatMoney(option.price_minor, option.currency)}
                          </span>
                          {option.id ===
                          supplierQuote.quote?.selected_option_id ? (
                            <span className="ml-3 inline-flex items-center rounded-full bg-espresso px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-bone">
                              Selected
                            </span>
                          ) : null}
                          {option.description ? (
                            <span className="mt-1 block text-espresso-faint">
                              {option.description}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {supplierQuote.capBreach ? (
                  <p className="border-t border-line bg-amberwarm-soft px-8 py-5 text-sm text-amberwarm-deep">
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
                  <p className="border-t border-line px-8 py-5 text-sm text-espresso-soft">
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
            className="rounded-full border border-espresso px-7 py-3 text-sm font-medium text-espresso hover:bg-espresso hover:text-bone"
          >
            Requote address modes
          </button>
        ) : null}
      </form>
    </div>
  );
}
