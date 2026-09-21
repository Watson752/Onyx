"use client";

import { useEffect, useState } from "react";

export type SupplierRow = {
  id: number;
  url: string;
  name: string;
  agnicMerchantId: string | null;
  status: string;
  rail: string | null;
  currency: string | null;
  explorePhase: string;
  exploreError: string | null;
  catalogItemCount: number;
};

const POLL_MS = 4_000;
const POLL_LIMIT_MS = 5 * 60 * 1_000;

function SupplierTableRow({ initial }: { initial: SupplierRow }) {
  const [row, setRow] = useState(initial);
  const [mountedAt] = useState(() => Date.now());
  const [pollCapReached, setPollCapReached] = useState(false);

  useEffect(() => {
    if (row.explorePhase !== "polling") return;
    if (Date.now() - mountedAt >= POLL_LIMIT_MS) {
      const expiredTimer = window.setTimeout(() => setPollCapReached(true), 0);
      return () => window.clearTimeout(expiredTimer);
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/suppliers/${row.id}/explore`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as {
          supplier: {
            id: number;
            url: string;
            name: string;
            agnicMerchantId: string | null;
            status: string;
            rail: string | null;
            currency: string | null;
            explorePhase: string;
            exploreError: string | null;
          };
          catalogItemCount: number;
        };
        setRow({
          id: body.supplier.id,
          url: body.supplier.url,
          name: body.supplier.name,
          agnicMerchantId: body.supplier.agnicMerchantId,
          status: body.supplier.status,
          rail: body.supplier.rail,
          currency: body.supplier.currency,
          explorePhase: body.supplier.explorePhase,
          exploreError: body.supplier.exploreError,
          catalogItemCount: body.catalogItemCount,
        });
      } catch {
        // Transient network error; the next tick tries again.
      }
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [row.explorePhase, row.id, mountedAt]);

  const isPolling = row.explorePhase === "polling";
  const isError = row.explorePhase === "error";

  return (
    <tr className="md:border-t md:border-line md:align-top">
      <td className="md:px-6 md:py-5" data-primary="">
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium break-words text-espresso underline decoration-line-strong underline-offset-4 hover:text-terracotta"
        >
          {row.name}
        </a>
        <div className="mt-1 font-mono text-xs break-all text-espresso-faint">
          {row.agnicMerchantId ?? "—"}
        </div>
      </td>
      <td className="md:px-6 md:py-5" data-label="Status">
        {isPolling ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-amberwarm-soft px-3 py-1 text-xs font-medium text-amberwarm-deep">
            <span className="size-3 animate-spin rounded-full border-2 border-amberwarm border-t-transparent" />
            {pollCapReached ? "still exploring" : "exploring…"}
          </span>
        ) : isError ? (
          <span className="inline-flex max-w-[70%] rounded-xl bg-brick-soft px-3 py-1.5 text-left text-xs font-medium break-words text-brick">
            {row.exploreError ?? row.status}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-xs font-medium tracking-wide text-sage-deep">
            {row.status}
          </span>
        )}
      </td>
      <td className="text-espresso-soft md:px-6 md:py-5" data-label="Rail">
        {row.rail ?? "unknown"}
      </td>
      <td className="text-espresso-soft md:px-6 md:py-5" data-label="Currency">
        {row.currency ?? "unknown"}
      </td>
      <td
        className="tabular-nums text-espresso-soft md:px-6 md:py-5 md:text-right"
        data-label="Catalog"
      >
        {row.catalogItemCount} items
      </td>
    </tr>
  );
}

export function SupplierTable({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="md:overflow-x-auto md:rounded-2xl md:border md:border-line md:bg-cream">
      <table className="stack-table stack-table-cards w-full text-left text-sm md:min-w-[40rem]">
        <thead className="bg-beige">
          <tr className="text-[11px] uppercase tracking-[0.16em] text-espresso-soft">
            <th className="px-5 py-4 font-semibold sm:px-6">Supplier</th>
            <th className="px-5 py-4 font-semibold sm:px-6">Status</th>
            <th className="px-5 py-4 font-semibold sm:px-6">Rail</th>
            <th className="px-5 py-4 font-semibold sm:px-6">Currency</th>
            <th className="px-5 py-4 text-right font-semibold sm:px-6">Catalog</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <SupplierTableRow key={supplier.id} initial={supplier} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
