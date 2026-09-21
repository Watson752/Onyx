"use client";

export default function PriceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-5 py-10 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl">
        Pricing failed
      </h1>
      <p className="rounded-2xl border border-brick/30 bg-brick-soft p-6 text-brick">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 w-full rounded-full bg-terracotta px-7 py-3 text-sm font-medium text-bone hover:bg-terracotta-deep sm:w-auto"
      >
        Retry
      </button>
    </main>
  );
}
