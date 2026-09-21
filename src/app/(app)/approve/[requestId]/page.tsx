import Link from "next/link";
import { notFound } from "next/navigation";

import { Money, formatMoney } from "@/components/money";
import { SubmitButton } from "@/components/submit-button";
import { prepareApprovalCarts } from "@/lib/approval";
import { prisma } from "@/lib/prisma";
import { parsedRequestSchema } from "@/lib/schemas";

import { confirmApproval } from "./actions";

export const dynamic = "force-dynamic";
// prepareApprovalCarts re-quotes every supplier (same reasoning as price/page.tsx).
export const maxDuration = 60;

function integerParam(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export default async function ApprovePage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { requestId: rawRequestId } = await params;
  const requestId = Number.parseInt(rawRequestId, 10);
  if (!Number.isInteger(requestId)) notFound();

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) notFound();

  const parsed = parsedRequestSchema.parse(JSON.parse(request.parsedJson));
  const query = await searchParams;
  const initialCaps = {
    maxTotalMinor: integerParam(query.maxTotalMinor, parsed.budget_minor),
    maxShippingMinor: integerParam(
      query.maxShippingMinor,
      Math.min(2_000, Math.floor(parsed.budget_minor * 0.2)),
    ),
  };
  const omitValues = Array.isArray(query.omitShipTo)
    ? query.omitShipTo
    : query.omitShipTo
      ? [query.omitShipTo]
      : [];
  const addressModeWasSet =
    (Array.isArray(query.addressModeSet)
      ? query.addressModeSet[0]
      : query.addressModeSet) === "1";

  let carts;
  try {
    carts = await prepareApprovalCarts(parsed, initialCaps, {
      omitShipToMerchantIds: new Set(omitValues),
      autoCardholderFallback: !addressModeWasSet,
    });
  } catch (error) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10 sm:px-6 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Approval preview refused safely
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl md:text-5xl">
          A fresh quote is required
        </h1>
        <p className="rounded-2xl border border-amberwarm/30 bg-amberwarm-soft p-6 text-amberwarm-deep">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Link
          className="inline-block rounded-full border border-espresso px-7 py-3 text-sm font-medium text-espresso hover:bg-espresso hover:text-bone"
          href={`/price?requestId=${request.id}`}
        >
          Return to pricing
        </Link>
      </main>
    );
  }

  const batch = await prisma.approvalBatch.create({
    data: {
      requestId: request.id,
      cartsJson: JSON.stringify(carts),
    },
  });
  const confirm = confirmApproval.bind(null, batch.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-5 py-10 sm:space-y-14 sm:px-6 sm:py-16">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Approval required
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl md:text-5xl">
          Approve request #{request.id}
        </h1>
        <p className="mt-4 max-w-2xl text-espresso-soft">
          One independent order will be placed per supplier. Review every
          item and cap before confirming.
        </p>
      </section>

      <div className="space-y-8">
        {carts.map((cart) => (
          <article
            key={cart.merchantId}
            className="overflow-hidden rounded-2xl border border-line-strong bg-cream"
          >
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-beige px-6 py-5 sm:px-8 sm:py-6">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-espresso sm:text-2xl">
                  {cart.supplierName}
                </h2>
                <p className="mt-1 font-mono text-xs break-all text-espresso-faint">
                  {cart.merchantId}
                </p>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  cart.amountIsFinal
                    ? "bg-sage-soft text-sage-deep"
                    : "bg-amberwarm-soft text-amberwarm-deep"
                }`}
              >
                {cart.amountIsFinal ? "Final" : "Ceiling"}
              </span>
            </header>

            <div className="divide-y divide-line">
              {cart.displayItems.map((item) => (
                <div
                  key={`${item.sku}-${item.query}`}
                  className="grid gap-1 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-8 sm:py-6"
                >
                  <div>
                    <p className="font-medium text-espresso">{item.title}</p>
                    <p className="mt-1 text-sm text-espresso-faint">
                      For “{item.query}” · {item.sku}
                    </p>
                  </div>
                  <p className="tabular-nums text-espresso-soft">
                    Qty {item.quantity}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-8 border-t border-line bg-bone px-6 py-6 sm:grid-cols-2 sm:px-8 sm:py-7">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                  {cart.amountIsFinal ? "Delivered total" : "Checkout ceiling"}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-espresso sm:text-4xl">
                  <Money
                    amountMinor={cart.amountMinor}
                    currency={cart.currency}
                  />
                </p>
                {!cart.amountIsFinal ? (
                  <p className="mt-3 text-sm text-amberwarm-deep">
                    Tax is added at checkout. The total cap includes 20%
                    headroom above this incomplete amount.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                  Caps sent verbatim
                </p>
                <p className="mt-2 text-espresso-soft">
                  Total:{" "}
                  <strong className="font-medium tabular-nums text-espresso">
                    {formatMoney(
                      cart.constraints.max_total_minor,
                      cart.currency,
                    )}
                  </strong>
                </p>
                <p className="text-espresso-soft">
                  Shipping:{" "}
                  <strong className="font-medium tabular-nums text-espresso">
                    {formatMoney(
                      cart.constraints.max_shipping_minor,
                      cart.currency,
                    )}
                  </strong>
                </p>
              </div>
              <div className="border-t border-line pt-6 sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                  Address mode
                </p>
                {cart.addressMode === "ship_to" && cart.shipTo ? (
                  <p className="mt-2 break-words text-espresso-soft">
                    ship_to: {cart.shipTo.name}, {cart.shipTo.street_address},{" "}
                    {cart.shipTo.address_locality}, {cart.shipTo.address_region}{" "}
                    {cart.shipTo.postal_code}, {cart.shipTo.address_country}
                  </p>
                ) : cart.addressMode === "cardholder" ? (
                  <p className="mt-2 text-espresso-soft">
                    Cardholder saved address. The ship_to field will be
                    omitted from quote and dispatch.
                  </p>
                ) : (
                  <p className="mt-2 text-espresso-soft">
                    Pickup. No address will be sent.
                    {cart.fulfillmentOption
                      ? ` ${cart.fulfillmentOption.title} is selected.`
                      : ""}
                  </p>
                )}
                {cart.fulfillmentOption ? (
                  <p className="mt-2 text-sm text-espresso-faint">
                    Fulfilment: {cart.fulfillmentOption.title} (
                    {cart.fulfillmentOption.type})
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <form
        action={confirm}
        className="space-y-6 rounded-2xl border border-line bg-cream p-6 sm:p-8"
      >
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
          Your confirmation
          <input
            name="confirmationText"
            required
            defaultValue="I approve these supplier orders and spending caps."
            className="mt-2 block w-full rounded-xl border border-line-strong bg-bone px-4 py-3 text-base font-normal tracking-normal normal-case text-espresso focus:border-terracotta focus:outline-none focus:ring-4 focus:ring-terracotta/10"
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-espresso-soft">
          <input
            type="checkbox"
            name="understandsCharge"
            value="yes"
            required
            className="mt-1 size-4 accent-terracotta"
          />
          <span>
            I understand this confirmation creates one approval per supplier
            and immediately starts the money-spending dispatch step.
          </span>
        </label>
        <SubmitButton idle="Confirm and dispatch" pending="Saving approval…" />
      </form>
    </main>
  );
}
