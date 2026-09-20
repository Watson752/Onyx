import { getOrderEvidence } from "@/lib/agnic";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params;
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
    select: { agnicOrderId: true },
  });
  if (!approval?.agnicOrderId) {
    return Response.json({ error: "order_not_found" }, { status: 404 });
  }

  const response = await getOrderEvidence(approval.agnicOrderId);
  return Response.json(response.body, { status: response.status });
}
