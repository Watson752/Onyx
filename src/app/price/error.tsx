"use client";

export default function PriceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-espresso">
        Pricing failed
      </h1>
      <p className="rounded-2xl border border-brick/30 bg-brick-soft p-6 text-brick">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-terracotta px-7 py-3 text-sm font-medium text-bone hover:bg-terracotta-deep"
      >
        Retry
      </button>
    </main>
  );
}
