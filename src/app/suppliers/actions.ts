"use server";

import { revalidatePath } from "next/cache";

import { exploreSupplier } from "@/lib/agnic";
import { prisma } from "@/lib/prisma";
import { supplierFormSchema } from "@/lib/schemas";

const EXPLORE_GOAL =
  "Buy supplies for a cafe, delivered in Ontario, Canada";

export type SupplierActionState = {
  ok: boolean;
  message: string;
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
    const explored = await exploreSupplier(parsed.data.url, EXPLORE_GOAL);
    const uniqueProducts = [
      ...new Map(
        explored.products.map((product) => [product.sku, product]),
      ).values(),
    ];

    await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.upsert({
        where: { url: parsed.data.url },
        create: {
          url: parsed.data.url,
          name: explored.name,
          agnicMerchantId: explored.merchantId,
          status: explored.status,
          rail: explored.rail,
          currency: explored.currency,
          exploredAt: new Date(),
        },
        update: {
          name: explored.name,
          agnicMerchantId: explored.merchantId,
          status: explored.status,
          rail: explored.rail,
          currency: explored.currency,
          exploredAt: new Date(),
        },
      });

      await tx.catalogItem.deleteMany({ where: { supplierId: supplier.id } });
      if (uniqueProducts.length > 0) {
        await tx.catalogItem.createMany({
          data: uniqueProducts.map((product) => ({
            supplierId: supplier.id,
            sku: product.sku,
            title: product.title,
            priceMinor: product.priceMinor,
            currency: product.currency,
          })),
        });
      }
    });

    revalidatePath("/suppliers");
    return {
      ok: true,
      message: `Stored ${explored.name} with ${uniqueProducts.length} matched product(s).`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
