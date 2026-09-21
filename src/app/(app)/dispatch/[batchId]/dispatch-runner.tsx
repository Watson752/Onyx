"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatMoney } from "@/components/money";

type DispatchApproval = {
  id: string;
  requestId: number;
  supplierName: string;
  amountMinor: number;
  currency: string;
  status: string;
  claimedAt: string | null;
  agnicOrderId: string | null;
  approvalUrl: string | null;
  approvalExpiresAt: string | null;
  amountChargedMinor: number | null;
  evidenceScreenshotsCount: number | null;
  evidenceUrl: string | null;
  decision: string | null;
  decisionReason: string | null;
  refusalFigureMinor: number | null;
  refusalCapMinor: number | null;
};

const POLL_MS = 4_000;
const POLL_LIMIT_MS = 5 * 60 * 1_000;

function stillPolling(status: string) {
  return status === "processing" || status === "approval_required";
}

function DispatchCard({ initial }: { initial: DispatchApproval }) {
  const [approval, setApproval] = useState(initial);
  const [message, setMessage] = useState("");
  const [mountedAt] = useState(() => Date.now());
  const [pollTick, setPollTick] = useState(0);
  const [pollCapReached, setPollCapReached] = useState(
    () =>
      stillPolling(initial.status) &&
      initial.claimedAt !== null &&
      Date.now() - new Date(initial.claimedAt).getTime() >= POLL_LIMIT_MS,
  );
  const initialAttempted = useRef(false);
  const resumeAttempted = useRef(false);
  const pollingStartedAt = approval.claimedAt
    ? new Date(approval.claimedAt).getTime()
    : mountedAt;

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/dispatch/${approval.id}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Status refresh returned ${response.status}.`);
    const body = (await response.json()) as { approval: DispatchApproval };
    setApproval(body.approval);
    return body.approval;
  }, [approval.id]);

  const dispatch = useCallback(
    async (mode: "initial" | "resume") => {
      setMessage(mode === "initial" ? "Claiming approval…" : "Resending once…");
      try {
        const response = await fetch(`/api/dispatch/${approval.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        });
        if (response.ok) {
          const body = (await response.json()) as {
            approval: DispatchApproval;
          };
          setApproval(body.approval);
          setMessage("");
        } else {
          await refresh();
          setMessage("");
        }
      } catch {
        setMessage(
          "The connection ended. Onyx will only refresh stored state; it will not blindly resend.",
        );
        try {
          await refresh();
        } catch {
          // Keep the safety message and let the user reload later.
        }
      }
    },
    [approval.id, refresh],
  );

  useEffect(() => {
    if (approval.status === "approved" && !initialAttempted.current) {
      initialAttempted.current = true;
      void dispatch("initial");
    }
  }, [approval.status, dispatch]);

  useEffect(() => {
    if (
      approval.status === "step_up_approved" &&
      !resumeAttempted.current
    ) {
      resumeAttempted.current = true;
      void dispatch("resume");
    }
  }, [approval.status, dispatch]);

  useEffect(() => {
    if (!stillPolling(approval.status)) return;
    const remaining = POLL_LIMIT_MS - (Date.now() - pollingStartedAt);
    if (remaining <= 0) {
      const expiredTimer = window.setTimeout(
        () => setPollCapReached(true),
        0,
      );
      return () => window.clearTimeout(expiredTimer);
    }
    const timer = window.setTimeout(() => {
      if (Date.now() - pollingStartedAt >= POLL_LIMIT_MS) {
        setPollCapReached(true);
      } else {
        void refresh()
          .catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : String(error));
          })
          .finally(() => setPollTick((tick) => tick + 1));
      }
    }, Math.min(POLL_MS, remaining));
    return () => window.clearTimeout(timer);
  }, [approval.status, pollTick, pollingStartedAt, refresh]);

  const isRefusal =
    approval.status === "refused" ||
    approval.status === "re_preview_required";
  const isUncertain = approval.status === "uncertain";

  return (
    <article
      className={`rounded-2xl border p-6 sm:p-8 ${
        isRefusal
          ? "border-amberwarm/40 bg-amberwarm-soft"
          : isUncertain
            ? "border-amberwarm/60 bg-amberwarm-soft"
            : approval.status === "succeeded"
              ? "border-sage/40 bg-sage-soft"
              : "border-line bg-cream"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-espresso sm:text-2xl">
            {approval.supplierName}
          </h2>
          <p className="mt-1 text-sm tabular-nums text-espresso-soft">
            Approved {formatMoney(approval.amountMinor, approval.currency)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${
            isUncertain
              ? "bg-amberwarm text-bone"
              : isRefusal
                ? "bg-amberwarm-soft text-amberwarm-deep ring-1 ring-amberwarm/40"
                : approval.status === "succeeded"
                  ? "bg-sage text-bone"
                  : approval.status === "failed"
                    ? "bg-brick-soft text-brick"
                    : "bg-beige-deep text-espresso-soft"
          }`}
        >
          {approval.status.replaceAll("_", " ")}
        </span>
      </div>

      {approval.agnicOrderId ? (
        <p className="mt-5 font-mono text-xs break-all text-espresso-faint">
          Order: {approval.agnicOrderId}
        </p>
      ) : null}
      {approval.amountChargedMinor !== null ? (
        <p className="mt-5 font-display text-2xl font-semibold tabular-nums tracking-tight text-espresso sm:text-3xl">
          Charged{" "}
          {formatMoney(approval.amountChargedMinor, approval.currency)}
        </p>
      ) : null}
      {approval.decision ? (
        <div className="mt-5">
          <p className="font-medium text-espresso">{approval.decision}</p>
          <p className="mt-1 text-sm text-espresso-soft">
            {approval.decisionReason}
          </p>
        </div>
      ) : null}
      {isUncertain ? (
        <p className="mt-5 rounded-xl bg-amberwarm/15 px-5 py-4 font-medium text-amberwarm-deep">
          Money may have moved. Do not retry or auto-refund. Check the card
          statement.
        </p>
      ) : null}
      {isRefusal ? (
        <div className="mt-5">
          {approval.refusalFigureMinor !== null &&
          approval.refusalCapMinor !== null ? (
            <p className="font-medium tabular-nums text-espresso">
              Observed{" "}
              {formatMoney(approval.refusalFigureMinor, approval.currency)}{" "}
              against cap{" "}
              {formatMoney(approval.refusalCapMinor, approval.currency)}.
              Nothing was charged.
            </p>
          ) : (
            <p className="font-medium text-espresso">
              Agnic refused before charging.
            </p>
          )}
          <Link
            href={`/approve/${approval.requestId}`}
            className="mt-4 inline-block rounded-full border border-espresso px-6 py-2.5 text-sm font-medium text-espresso hover:bg-espresso hover:text-bone"
          >
            Re-quote and request a new approval
          </Link>
        </div>
      ) : null}
      {approval.approvalUrl &&
      (approval.status === "approval_required" ||
        approval.status === "cvv_refresh_required") ? (
        <div className="mt-6 rounded-xl border border-line bg-cream p-6">
          <a
            href={approval.approvalUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-terracotta underline decoration-terracotta/40 underline-offset-4 hover:text-terracotta-deep"
          >
            Open secure approval
          </a>
          {approval.status === "approval_required" ? (
            <p className="mt-2 text-sm text-espresso-soft">
              Complete the passkey step. Onyx polls the approval endpoint and
              will dispatch exactly once more with the returned token.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-espresso-soft">
                Enter any three digits there, then use the controlled resend
                below.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (resumeAttempted.current) return;
                  resumeAttempted.current = true;
                  void dispatch("resume");
                }}
                className="mt-4 rounded-full bg-terracotta px-6 py-2.5 text-sm font-medium text-bone hover:bg-terracotta-deep"
              >
                I refreshed CVV — resend once
              </button>
            </>
          )}
        </div>
      ) : null}
      {approval.evidenceUrl ? (
        <p className="mt-6">
          <a
            href={approval.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-terracotta underline decoration-terracotta/40 underline-offset-4 hover:text-terracotta-deep"
          >
            View evidence
            {approval.evidenceScreenshotsCount !== null
              ? ` (${approval.evidenceScreenshotsCount} screenshots)`
              : ""}
          </a>
        </p>
      ) : null}
      {message ? (
        <p className="mt-5 text-sm text-espresso-soft">{message}</p>
      ) : null}
      {pollCapReached && stillPolling(approval.status) ? (
        <div className="mt-5 text-sm text-espresso-soft">
          <p>
            Five-minute automatic polling cap reached. The stored order id is
            safe and Onyx will not re-dispatch.
          </p>
          <button
            type="button"
            onClick={() =>
              void refresh().catch((error: unknown) => {
                setMessage(error instanceof Error ? error.message : String(error));
              })
            }
            className="mt-3 rounded-full border border-line-strong bg-cream px-5 py-2 text-espresso hover:border-espresso"
          >
            Check status once
          </button>
        </div>
      ) : null}
    </article>
  );
}

export function DispatchRunner({
  approvals,
}: {
  approvals: DispatchApproval[];
}) {
  return (
    <div className="space-y-8">
      {approvals.map((approval) => (
        <DispatchCard key={approval.id} initial={approval} />
      ))}
    </div>
  );
}
