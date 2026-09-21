"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/submit-button";

import { addSupplier, type SupplierActionState } from "./actions";

const initialSupplierState: SupplierActionState = {
  ok: false,
  message: "",
};

export function SupplierForm() {
  const [state, action] = useActionState(addSupplier, initialSupplierState);

  return (
    <form
      action={action}
      className="space-y-6 rounded-2xl border border-line bg-cream p-6 sm:p-8"
    >
      <div>
        <label
          htmlFor="url"
          className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-espresso-faint"
        >
          Supplier domain or store URL
        </label>
        <input
          id="url"
          name="url"
          type="text"
          inputMode="url"
          required
          placeholder="monogramcoffee.com"
          className="w-full rounded-xl border border-line-strong bg-bone px-4 py-3 text-espresso placeholder:text-espresso-faint focus:border-terracotta focus:outline-none focus:ring-4 focus:ring-terracotta/10"
        />
      </div>
      <p className="rounded-xl bg-amberwarm-soft px-5 py-4 text-sm text-amberwarm-deep">
        Explore is read-only, but it drives the live checkout and can take
        about two minutes. The table below keeps polling for the result even
        if you navigate away and come back.
      </p>
      <SubmitButton idle="Explore supplier" pending="Starting explore…" />
      {state.message ? (
        <p
          role="status"
          className={
            state.ok ? "text-sm text-sage-deep" : "text-sm text-brick"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
