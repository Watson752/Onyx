import { RequestForm } from "./request-form";

// Covers the parseRequest Server Action's LLM call, which has no hard
// timeout of its own.
export const maxDuration = 60;

export default function RequestPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10">
      <section>
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Step 2
        </p>
        <h1 className="text-3xl font-black">Parse a supply request</h1>
        <p className="mt-2 text-zinc-600">
          Claude converts free text into validated items, quantities, currency,
          and a budget.
        </p>
      </section>
      <RequestForm />
    </main>
  );
}
