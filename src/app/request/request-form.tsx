"use client";

import Link from "next/link";
import { useActionState } from "react";

import { formatMoney } from "@/components/money";
import { SubmitButton } from "@/components/submit-button";

import { initialRequestState, parseRequest } from "./actions";

export function RequestForm() {
  const [state, action] = useActionState(parseRequest, initialRequestState);

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-lg border bg-white p-5">
        <div>
          <label
            htmlFor="rawText"
            className="mb-1 block text-sm font-semibold"
          >
            What does the cafe need?
          </label>
          <textarea
            id="rawText"
            name="rawText"
            required
            rows={8}
            placeholder="We need 4 bags of medium-roast coffee beans and 500 paper cups. Budget CAD $400."
            className="w-full rounded border border-zinc-300 px-3 py-2"
          />
        </div>
        <SubmitButton idle="Parse with Claude" pending="Parsing…" />
        {state.message ? (
          <p className={state.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
            {state.message}
          </p>
        ) : null}
      </form>

      {state.parsed && state.requestId ? (
        <section className="space-y-4 rounded-lg border bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Parsed request</h2>
            <Link
              href={`/price?requestId=${state.requestId}`}
              className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Price this request
            </Link>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {state.parsed.items.map((item, index) => (
              <li key={`${item.query}-${index}`}>
                {item.quantity} × {item.query}
              </li>
            ))}
          </ul>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Budget</dt>
              <dd>
                {formatMoney(
                  state.parsed.budget_minor,
                  state.parsed.currency,
                )}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Notes</dt>
              <dd>{state.parsed.notes || "None"}</dd>
            </div>
          </dl>
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Strict JSON
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
              {JSON.stringify(state.parsed, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
