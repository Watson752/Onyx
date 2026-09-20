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
    <form action={action} className="space-y-4 rounded-lg border bg-white p-5">
      <div>
        <label htmlFor="url" className="mb-1 block text-sm font-semibold">
          Supplier store URL
        </label>
        <input
          id="url"
          name="url"
          type="url"
          required
          placeholder="https://eightouncecoffee.ca"
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
      </div>
      <p className="text-sm text-amber-700">
        Explore is read-only, but it drives the live checkout and can take
        about two minutes. The table below keeps polling for the result even
        if you navigate away and come back.
      </p>
      <SubmitButton idle="Explore supplier" pending="Starting explore…" />
      {state.message ? (
        <p
          role="status"
          className={state.ok ? "text-sm text-green-700" : "text-sm text-red-700"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
