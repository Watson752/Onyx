import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { DispatchRunner } from "./dispatch-runner";

export const dynamic = "force-dynamic";

export default async function DispatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const batch = await prisma.approvalBatch.findUnique({
    where: { id: batchId },
    include: {
      approvals: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!batch?.confirmedAt || batch.approvals.length === 0) notFound();

  const approvals = batch.approvals.map((approval) => ({
    id: approval.id,
    requestId: approval.requestId,
    supplierName: approval.supplierName,
    amountMinor: approval.amountMinor,
    currency: approval.currency,
    status: approval.status,
    claimedAt: approval.claimedAt?.toISOString() ?? null,
    agnicOrderId: approval.agnicOrderId,
    approvalUrl: approval.approvalUrl,
    approvalExpiresAt: approval.approvalExpiresAt?.toISOString() ?? null,
    amountChargedMinor: approval.amountChargedMinor,
    evidenceScreenshotsCount: approval.evidenceScreenshotsCount,
    evidenceUrl: approval.evidenceUrl,
    decision: approval.decision,
    decisionReason: approval.decisionReason,
    refusalFigureMinor: approval.refusalFigureMinor,
    refusalCapMinor: approval.refusalCapMinor,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-14 px-6 py-16">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-espresso-faint">
          Independent supplier dispatch
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-espresso sm:text-5xl">
          Approved orders
        </h1>
        <p className="mt-4 max-w-2xl text-espresso-soft">
          Each supplier is claimed and tracked independently. A refusal or
          failure here does not stop any other supplier.
        </p>
      </section>
      <DispatchRunner approvals={approvals} />
    </main>
  );
}
