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
    <main className="mx-auto w-full max-w-6xl space-y-10 px-5 py-10 sm:space-y-14 sm:px-6 sm:py-16">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Step 1
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-espresso sm:text-4xl md:text-5xl">
          Supplier onboarding
        </h1>
        <p className="mt-4 max-w-2xl text-espresso-soft">
          Teach Agnic a supplier checkout and save the products it discovers.
          Nothing is purchased.
        </p>
      </section>

      <SupplierForm />

      <section className="space-y-5">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-espresso">
          Stored suppliers
        </h2>
        {suppliers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-cream p-8 text-center sm:p-10 text-espresso-faint">
            No suppliers yet.
          </p>
        ) : (
          <SupplierTable suppliers={suppliers} />
        )}
      </section>
    </main>
  );
}
