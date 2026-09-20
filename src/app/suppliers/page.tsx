import { prisma } from "@/lib/prisma";

import { SupplierForm } from "./supplier-form";
import { SupplierTable } from "./supplier-table";

export const dynamic = "force-dynamic";
// Server Actions on this page (addSupplier) inherit this cap. On Vercel
// Hobby it's clamped to 60s regardless — see supplier-form.tsx for why that's
// fine: addSupplier only does the fast kickoff call now, not the full crawl.
export const maxDuration = 60;

export default async function SuppliersPage() {
  const rows = await prisma.supplier.findMany({
    include: { _count: { select: { catalogItems: true } } },
    orderBy: { exploredAt: "desc" },
  });
  const suppliers = rows.map((supplier) => ({
    id: supplier.id,
    url: supplier.url,
    name: supplier.name,
    agnicMerchantId: supplier.agnicMerchantId,
    status: supplier.status,
    rail: supplier.rail,
    currency: supplier.currency,
    explorePhase: supplier.explorePhase,
    exploreError: supplier.exploreError,
    catalogItemCount: supplier._count.catalogItems,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10">
      <section>
        <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
          Step 1
        </p>
        <h1 className="text-3xl font-black">Supplier onboarding</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Teach Agnic a supplier checkout and save the products it discovers.
          Nothing is purchased.
        </p>
      </section>

      <SupplierForm />

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Stored suppliers</h2>
        {suppliers.length === 0 ? (
          <p className="rounded border border-dashed p-6 text-zinc-500">
            No suppliers yet.
          </p>
        ) : (
          <SupplierTable suppliers={suppliers} />
        )}
      </section>
    </main>
  );
}
