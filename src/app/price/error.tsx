"use client";

export default function PriceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 px-6 py-10">
      <h1 className="text-3xl font-black">Pricing failed</h1>
      <p className="rounded border border-red-300 bg-red-50 p-4">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-zinc-950 px-4 py-2 font-semibold text-white"
      >
        Retry
      </button>
    </main>
  );
}
