"use client";

import Link from "next/link";
import { useActionState } from "react";

import { formatMoney } from "@/components/money";
import { SubmitButton } from "@/components/submit-button";

import { parseRequest, type RequestActionState } from "./actions";

const initialRequestState: RequestActionState = {
  ok: false,
  message: "",
};

export function RequestForm() {
  const [state, action] = useActionState(parseRequest, initialRequestState);

  return (
    <div className="space-y-10">
      <form
        action={action}
        className="space-y-6 rounded-2xl border border-line bg-cream p-6 sm:p-8"
      >
        <div>
          <label
            htmlFor="rawText"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint"
          >
            What does the cafe need?
          </label>
          <textarea
            id="rawText"
            name="rawText"
            required
            rows={8}
            placeholder="We need 4 bags of medium-roast coffee beans and 500 paper cups. Budget CAD $400."
            className="w-full rounded-xl border border-line-strong bg-bone px-4 py-3 text-espresso placeholder:text-espresso-faint focus:border-terracotta focus:outline-none focus:ring-4 focus:ring-terracotta/10"
          />
        </div>
        <SubmitButton idle="Parse with Claude" pending="Parsing…" />
        {state.message ? (
          <p
            className={
              state.ok
                ? "text-sm text-sage-deep"
                : "text-sm text-brick"
            }
          >
            {state.message}
          </p>
        ) : null}
      </form>

      {state.parsed && state.requestId ? (
        <section className="space-y-6 rounded-2xl border border-line bg-cream p-6 sm:p-8">
          <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-espresso">
              Parsed request
            </h2>
            <Link
              href={`/price?requestId=${state.requestId}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-terracotta px-6 py-3 text-center text-sm font-medium text-bone hover:bg-terracotta-deep sm:w-auto"
            >
              Price this request
            </Link>
          </div>
          <ul className="space-y-2 border-t border-line pt-5">
            {state.parsed.items.map((item, index) => (
              <li
                key={`${item.query}-${index}`}
                className="flex items-baseline gap-3 text-espresso"
              >
                <span className="tabular-nums font-medium text-terracotta">
                  {item.quantity} ×
                </span>
                <span>{item.query}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-6 border-t border-line pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                Budget
              </dt>
              <dd className="mt-1 text-lg tabular-nums text-espresso">
                {formatMoney(state.parsed.budget_minor, state.parsed.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint">
                Notes
              </dt>
              <dd className="mt-1 text-espresso-soft">
                {state.parsed.notes || "None"}
              </dd>
            </div>
          </dl>
          <details className="border-t border-line pt-5">
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint hover:text-terracotta">
              Strict JSON
            </summary>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-espresso p-4 text-xs leading-relaxed break-all text-bone sm:p-5 sm:break-normal">
              {JSON.stringify(state.parsed, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </div>
  );
}
