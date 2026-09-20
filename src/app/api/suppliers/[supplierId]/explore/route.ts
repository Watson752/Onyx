import { refreshSupplierExplore } from "@/lib/explore";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ supplierId: string }> },
) {
  const { supplierId: rawSupplierId } = await params;
  const supplierId = Number.parseInt(rawSupplierId, 10);
  if (!Number.isInteger(supplierId)) {
    return Response.json({ error: "invalid_supplier_id" }, { status: 400 });
  }

  const supplier = await refreshSupplierExplore(supplierId);
  if (!supplier) {
    return Response.json({ error: "supplier_not_found" }, { status: 404 });
  }

  const catalogItemCount = await prisma.catalogItem.count({
    where: { supplierId: supplier.id },
  });

  return Response.json({ supplier, catalogItemCount });
}
