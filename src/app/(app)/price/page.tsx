import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { priceRequest } from "@/lib/pricing";
import { parsedRequestSchema } from "@/lib/schemas";

import { PricingView } from "./pricing-view";

export const dynamic = "force-dynamic";
// Without this, Vercel's unset-maxDuration default is well under the 60s
// Hobby ceiling, and priceRequest can make several sequential Agnic calls
// across suppliers.
export const maxDuration = 60;

function dollarsToMinor(
  value: string | string[] | undefined,
  fallback: number,
) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim() === "") return fallback;
  const dollars = Number(raw);
  return Number.isFinite(dollars) && dollars >= 0
    ? Math.round(dollars * 100)
    : fallback;
}

export default async function PricePage({
  searchParams,
}: {
  searchParams: Promise<{
    requestId?: string | string[];
    maxTotalDollars?: string | string[];
    maxShippingDollars?: string | string[];
    omitShipTo?: string | string[];
    addressModeSet?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;
  const requestId = rawId ? Number.parseInt(rawId, 10) : undefined;
  const request =
    requestId && Number.isInteger(requestId)
      ? await prisma.request.findUnique({ where: { id: requestId } })
      : await prisma.request.findFirst({ orderBy: { createdAt: "desc" } });

  if (!request) {
    return (
      <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10 sm:px-6 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Step 3
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl md:text-5xl">
          Price a request
        </h1>
        <p className="text-espresso-soft">No parsed request exists yet.</p>
        <Link
          href="/request"
          className="inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-medium text-bone hover:bg-terracotta-deep"
        >
          Create a request
        </Link>
      </main>
    );
  }

  let parsed;
  try {
    parsed = parsedRequestSchema.parse(JSON.parse(request.parsedJson));
  } catch {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-16">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-espresso">
          Invalid stored request
        </h1>
        <p className="mt-4 text-espresso-soft">
          Request #{request.id} no longer matches the schema.
        </p>
      </main>
    );
  }

  const defaultShippingCap = Math.min(
    2_000,
    Math.floor(parsed.budget_minor * 0.2),
  );
  const caps = {
    maxTotalMinor: dollarsToMinor(
      params.maxTotalDollars,
      parsed.budget_minor,
    ),
    maxShippingMinor: dollarsToMinor(
      params.maxShippingDollars,
      defaultShippingCap,
    ),
  };
  const omitValues = Array.isArray(params.omitShipTo)
    ? params.omitShipTo
    : params.omitShipTo
      ? [params.omitShipTo]
      : [];
  const addressModeWasSet =
    (Array.isArray(params.addressModeSet)
      ? params.addressModeSet[0]
      : params.addressModeSet) === "1";
  const result = await priceRequest(parsed, caps, {
    omitShipToMerchantIds: new Set(omitValues),
    autoCardholderFallback: !addressModeWasSet,
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-10 sm:space-y-14 sm:px-6 sm:py-16">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Step 3
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl md:text-5xl">
          Price request #{request.id}
        </h1>
        <p className="mt-4 max-w-2xl text-espresso-soft">
          One read-only quote per supplier. Dispatch remains locked until a
          separate approval records the exact basket and caps.
        </p>
      </section>
      <form
        method="get"
        className="grid items-end gap-6 rounded-2xl border border-line bg-cream p-6 sm:p-8 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="requestId" value={request.id} />
        <input type="hidden" name="addressModeSet" value="1" />
        {result.quotes
          .filter((quote) => quote.addressMode !== "ship_to")
          .map((quote) => (
            <input
              key={quote.merchantId}
              type="hidden"
              name="omitShipTo"
              value={quote.merchantId}
            />
          ))}
        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
          Maximum total (CAD dollars)
          <input
            type="number"
            name="maxTotalDollars"
            min="0"
            step="0.01"
            defaultValue={(caps.maxTotalMinor / 100).toFixed(2)}
            className="mt-2 block w-full rounded-xl border border-line-strong bg-bone px-4 py-3 text-base font-normal tracking-normal text-espresso tabular-nums normal-case focus:border-terracotta focus:outline-none focus:ring-4 focus:ring-terracotta/10"
          />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
          Maximum shipping (CAD dollars)
          <input
            type="number"
            name="maxShippingDollars"
            min="0"
            step="0.01"
            defaultValue={(caps.maxShippingMinor / 100).toFixed(2)}
            className="mt-2 block w-full rounded-xl border border-line-strong bg-bone px-4 py-3 text-base font-normal tracking-normal text-espresso tabular-nums normal-case focus:border-terracotta focus:outline-none focus:ring-4 focus:ring-terracotta/10"
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-espresso px-7 py-3 text-sm font-medium text-espresso hover:bg-espresso hover:text-bone"
        >
          Requote
        </button>
        <p className="text-xs text-espresso-faint sm:col-span-3">
          These exact caps are sent to every quote. Lower shipping to force a
          safe cap refusal; no charge is possible.
        </p>
      </form>
      <PricingView requestId={request.id} parsed={parsed} result={result} />
    </main>
  );
}
