import { RequestForm } from "./request-form";

// Covers the parseRequest Server Action's LLM call, which has no hard
// timeout of its own.
export const maxDuration = 60;

export default function RequestPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-12 px-6 py-16">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Step 2
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-espresso sm:text-5xl">
          Parse a supply request
        </h1>
        <p className="mt-4 max-w-2xl text-espresso-soft">
          Claude converts free text into validated items, quantities, currency,
          and a budget.
        </p>
      </section>
      <RequestForm />
    </main>
  );
}
