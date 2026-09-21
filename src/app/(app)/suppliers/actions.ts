"use server";

import { revalidatePath } from "next/cache";

import { startSupplierExplore } from "@/lib/explore";
import { prisma } from "@/lib/prisma";
import { supplierFormSchema } from "@/lib/schemas";

export type SupplierActionState = {
  ok: boolean;
  message: string;
  supplierId?: number;
  phase?: "polling" | "done";
};

export async function addSupplier(
  _previous: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const parsed = supplierFormSchema.safeParse({
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  try {
    const supplier = await startSupplierExplore(parsed.data.url);
    revalidatePath("/suppliers");

    if (supplier.explorePhase === "done") {
      const count = await prisma.catalogItem.count({
        where: { supplierId: supplier.id },
      });
      return {
        ok: true,
        message: `Stored ${supplier.name} with ${count} matched product(s).`,
        supplierId: supplier.id,
        phase: "done",
      };
    }

    return {
      ok: true,
      message: `Exploring ${parsed.data.url}. This can take about two minutes — the table below updates on its own.`,
      supplierId: supplier.id,
      phase: "polling",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
