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
    <tr className="border-t">
      <td className="p-3">
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline"
        >
          {row.name}
        </a>
        <div className="font-mono text-xs text-zinc-500">
          {row.agnicMerchantId ?? "—"}
        </div>
      </td>
      <td className="p-3">
        {isPolling ? (
          <span className="inline-flex items-center gap-2">
            <span className="size-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
            {pollCapReached ? "still exploring" : "exploring…"}
          </span>
        ) : isError ? (
          <span className="text-red-700">{row.exploreError ?? row.status}</span>
        ) : (
          row.status
        )}
      </td>
      <td className="p-3">{row.rail ?? "unknown"}</td>
      <td className="p-3">{row.currency ?? "unknown"}</td>
      <td className="p-3">{row.catalogItemCount} items</td>
    </tr>
  );
}

export function SupplierTable({ suppliers }: { suppliers: SupplierRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-100">
          <tr>
            <th className="p-3">Supplier</th>
            <th className="p-3">Status</th>
            <th className="p-3">Rail</th>
            <th className="p-3">Currency</th>
            <th className="p-3">Catalog</th>
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
