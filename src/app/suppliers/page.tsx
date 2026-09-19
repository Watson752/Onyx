import { prisma } from "@/lib/prisma";

import { SupplierForm } from "./supplier-form";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    include: { _count: { select: { catalogItems: true } } },
    orderBy: { exploredAt: "desc" },
  });

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
                  <tr key={supplier.id} className="border-t">
                    <td className="p-3">
                      <a
                        href={supplier.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline"
                      >
                        {supplier.name}
                      </a>
                      <div className="font-mono text-xs text-zinc-500">
                        {supplier.agnicMerchantId}
                      </div>
                    </td>
                    <td className="p-3">{supplier.status}</td>
                    <td className="p-3">{supplier.rail ?? "unknown"}</td>
                    <td className="p-3">{supplier.currency ?? "unknown"}</td>
                    <td className="p-3">
                      {supplier._count.catalogItems} items
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
