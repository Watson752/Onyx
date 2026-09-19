import { Money, formatMoney } from "@/components/money";
import type { ParsedRequest } from "@/lib/schemas";
import type { PricingResult } from "@/lib/pricing";

export function PricingView({
  parsed,
  result,
}: {
  parsed: ParsedRequest;
  result: PricingResult;
}) {
  const selected = new Set(result.selectedMerchantIds);

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
          Greedy delivered-cost combination
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
              a budget of {formatMoney(parsed.budget_minor, parsed.currency)}.
            </p>
            {result.selectionIncludesCeiling ? (
              <p className="mt-2 rounded bg-amber-100 p-2 text-sm text-amber-900">
                This comparison includes at least one ceiling, not a final
                total. Tax may be added at checkout.
              </p>
            ) : null}
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

      <section className="space-y-5">
        <h2 className="text-2xl font-black">Supplier quotes</h2>
        {result.quotes.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-zinc-500">
            There were no onboarded candidate suppliers to quote.
          </p>
        ) : (
          result.quotes.map((supplierQuote) => {
            const isSelected = selected.has(supplierQuote.merchantId);
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
      </section>
    </div>
  );
}
