import { refreshDispatch, startDispatch } from "@/lib/dispatch";

export const dynamic = "force-dynamic";
// Vercel Hobby clamps this to 60s regardless of the value set here. Each
// individual call underneath (dispatchOrder: 45s, getOrder/getApprovalStatus:
// 30s) already fits; the 5-minute dispatch window is covered by the client
// re-polling this route every few seconds, not by one long request.
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params;
  const approval = await refreshDispatch(approvalId);
  if (!approval) {
    return Response.json({ error: "approval_not_found" }, { status: 404 });
  }
  return Response.json({ approval });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
) {
  const { approvalId } = await params;
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // An empty body means the initial, single dispatch attempt.
  }
  const mode =
    body &&
    typeof body === "object" &&
    "mode" in body &&
    body.mode === "resume"
      ? "resume"
      : "initial";
  const result = await startDispatch(approvalId, mode);
  if (!result.approval) {
    return Response.json({ error: "approval_not_found" }, { status: 404 });
  }
  return Response.json(result, { status: result.claimed ? 200 : 409 });
}
