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
      <main className="mx-auto w-full max-w-4xl space-y-4 px-6 py-10">
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Approval preview refused safely
        </p>
        <h1 className="text-3xl font-black">A fresh quote is required</h1>
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <Link
          className="inline-block font-semibold underline"
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
    <main className="mx-auto w-full max-w-5xl space-y-8 px-6 py-10">
      <section>
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Approval required
        </p>
        <h1 className="text-3xl font-black">Approve request #{request.id}</h1>
        <p className="mt-2 text-zinc-600">
          One independent order will be placed per supplier. Review every
          item and cap before confirming.
        </p>
      </section>

      <div className="space-y-5">
        {carts.map((cart) => (
          <article
            key={cart.merchantId}
            className="overflow-hidden rounded-lg border-2 border-zinc-900 bg-white"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 bg-zinc-100 p-4">
              <div>
                <h2 className="text-xl font-bold">{cart.supplierName}</h2>
                <p className="font-mono text-xs text-zinc-500">
                  {cart.merchantId}
                </p>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs font-black ${
                  cart.amountIsFinal
                    ? "bg-emerald-100 text-emerald-900"
                    : "bg-amber-100 text-amber-950"
                }`}
              >
                {cart.amountIsFinal ? "FINAL" : "CEILING"}
              </span>
            </header>

            <div className="divide-y">
              {cart.displayItems.map((item) => (
                <div
                  key={`${item.sku}-${item.query}`}
                  className="grid gap-1 p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-zinc-500">
                      For “{item.query}” · {item.sku}
                    </p>
                  </div>
                  <p className="font-bold">Qty {item.quantity}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 border-t bg-zinc-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {cart.amountIsFinal ? "Delivered total" : "Checkout ceiling"}
                </p>
                <p className="text-2xl font-black">
                  <Money
                    amountMinor={cart.amountMinor}
                    currency={cart.currency}
                  />
                </p>
                {!cart.amountIsFinal ? (
                  <p className="mt-1 text-sm text-amber-900">
                    Tax is added at checkout. The total cap includes 20%
                    headroom above this incomplete amount.
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Caps sent verbatim
                </p>
                <p>
                  Total:{" "}
                  <strong>
                    {formatMoney(
                      cart.constraints.max_total_minor,
                      cart.currency,
                    )}
                  </strong>
                </p>
                <p>
                  Shipping:{" "}
                  <strong>
                    {formatMoney(
                      cart.constraints.max_shipping_minor,
                      cart.currency,
                    )}
                  </strong>
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                  Address mode
                </p>
                {cart.addressMode === "ship_to" && cart.shipTo ? (
                  <p>
                    ship_to: {cart.shipTo.name}, {cart.shipTo.street_address},{" "}
                    {cart.shipTo.address_locality}, {cart.shipTo.address_region}{" "}
                    {cart.shipTo.postal_code}, {cart.shipTo.address_country}
                  </p>
                ) : cart.addressMode === "cardholder" ? (
                  <p>
                    Cardholder saved address. The ship_to field will be
                    omitted from quote and dispatch.
                  </p>
                ) : (
                  <p>
                    Pickup. No address will be sent.
                    {cart.fulfillmentOption
                      ? ` ${cart.fulfillmentOption.title} is selected.`
                      : ""}
                  </p>
                )}
                {cart.fulfillmentOption ? (
                  <p className="mt-1 text-sm text-zinc-600">
                    Fulfilment: {cart.fulfillmentOption.title} (
                    {cart.fulfillmentOption.type})
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      <form action={confirm} className="space-y-4 rounded-lg border p-5">
        <label className="block font-semibold">
          Your confirmation
          <input
            name="confirmationText"
            required
            defaultValue="I approve these supplier orders and spending caps."
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="understandsCharge"
            value="yes"
            required
            className="mt-1"
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
