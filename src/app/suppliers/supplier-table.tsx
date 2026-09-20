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
    <tr className="border-t border-line align-top">
      <td className="px-6 py-5">
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-espresso underline decoration-line-strong underline-offset-4 hover:text-terracotta"
        >
          {row.name}
        </a>
        <div className="mt-1 font-mono text-xs text-espresso-faint">
          {row.agnicMerchantId ?? "—"}
        </div>
      </td>
      <td className="px-6 py-5">
        {isPolling ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-amberwarm-soft px-3 py-1 text-xs font-medium text-amberwarm-deep">
            <span className="size-3 animate-spin rounded-full border-2 border-amberwarm border-t-transparent" />
            {pollCapReached ? "still exploring" : "exploring…"}
          </span>
        ) : isError ? (
          <span className="inline-flex rounded-full bg-brick-soft px-3 py-1 text-xs font-medium text-brick">
            {row.exploreError ?? row.status}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-sage-soft px-3 py-1 text-xs font-medium tracking-wide text-sage-deep">
            {row.status}
          </span>
        )}
      </td>
      <td className="px-6 py-5 text-espresso-soft">{row.rail ?? "unknown"}</td>
      <td className="px-6 py-5 text-espresso-soft">
        {row.currency ?? "unknown"}
      </td>
      <td className="px-6 py-5 text-right tabular-nums text-espresso-soft">
        {row.catalogItemCount} items
      </td>
    </tr>
  );
}

export function SupplierTable({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-cream">
      <table className="w-full text-left text-sm">
        <thead className="bg-beige">
          <tr className="text-[11px] uppercase tracking-[0.16em] text-espresso-soft">
            <th className="px-6 py-4 font-semibold">Supplier</th>
            <th className="px-6 py-4 font-semibold">Status</th>
            <th className="px-6 py-4 font-semibold">Rail</th>
            <th className="px-6 py-4 font-semibold">Currency</th>
            <th className="px-6 py-4 text-right font-semibold">Catalog</th>
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
