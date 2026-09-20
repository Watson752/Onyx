import "server-only";

import type { Approval } from "@prisma/client";

import {
  dispatchOrder,
  getApprovalStatus,
  getOrder,
  getOrderEvidence,
} from "./agnic";
import { prisma } from "./prisma";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function dispatchPayload(approval: Approval, includeApprovalToken: boolean) {
  if (approval.addressMode === "ship_to" && !approval.shipToJson) {
    throw new Error("Approved ship_to mode is missing its stored destination.");
  }
  return {
    merchant_id: approval.merchantId,
    items: JSON.parse(approval.itemsJson),
    amount_minor: approval.amountMinor,
    currency: approval.currency,
    user_confirmation_text: approval.userConfirmationText,
    user_approved_at_iso: approval.userApprovedAt.toISOString(),
    user_prompt: approval.userPrompt,
    ...(approval.fulfillmentOptionId
      ? { fulfillment_option_id: approval.fulfillmentOptionId }
      : {}),
    ...(approval.addressMode === "ship_to" && approval.shipToJson
      ? { ship_to: JSON.parse(approval.shipToJson) }
      : {}),
    constraints: JSON.parse(approval.constraintsJson),
    ...(includeApprovalToken && approval.approvalToken
      ? { approval_token: approval.approvalToken }
      : {}),
  };
}

function refusalFigures(body: JsonRecord, approval: Approval) {
  const constraints = record(JSON.parse(approval.constraintsJson));
  const shippingRefusal =
    typeof body.shipping_minor === "number" ||
    String(body.error ?? body.code ?? "").includes("shipping");
  if (shippingRefusal) {
    return {
      figure: typeof body.shipping_minor === "number" ? body.shipping_minor : null,
      cap:
        typeof body.max_shipping_minor === "number"
          ? body.max_shipping_minor
          : typeof constraints.max_shipping_minor === "number"
            ? constraints.max_shipping_minor
            : null,
    };
  }
  return {
    figure:
      typeof body.expected_amount_minor === "number"
        ? body.expected_amount_minor
        : typeof body.amount_minor === "number"
          ? body.amount_minor
          : null,
    cap:
      typeof body.max_total_minor === "number"
        ? body.max_total_minor
        : typeof constraints.max_total_minor === "number"
          ? constraints.max_total_minor
          : null,
  };
}

async function saveDispatchOutcome(approval: Approval, status: number, body: JsonRecord) {
  const orderId = typeof body.order_id === "string" ? body.order_id : null;
  if (orderId) {
    // This write is deliberately first. No response metadata is saved before
    // the durable identifier that lets us recover without another dispatch.
    await prisma.approval.update({
      where: { id: approval.id },
      data: { agnicOrderId: orderId },
    });
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: "processing",
        dispatchResponseJson: JSON.stringify(body),
        evidenceUrl:
          typeof body.order_url === "string"
            ? body.order_url
            : typeof body.live_view_url === "string"
              ? body.live_view_url
              : null,
        decision: "dispatched",
        decisionReason: "Agnic accepted the approved snapshot; polling the returned order id.",
      },
    });
    return;
  }

  if (status === 202 && body.approval_required === true) {
    const expiresIn =
      typeof body.expires_in === "number" ? body.expires_in : null;
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: "approval_required",
        approvalToken:
          typeof body.approval_token === "string" ? body.approval_token : null,
        approvalUrl:
          typeof body.approval_url === "string" ? body.approval_url : null,
        approvalExpiresAt:
          expiresIn === null ? null : new Date(Date.now() + expiresIn * 1_000),
        dispatchResponseJson: JSON.stringify(body),
        decision: "waiting for passkey",
        decisionReason:
          typeof body.reason === "string"
            ? body.reason
            : "Agnic requires a passkey step-up. No order has been placed.",
      },
    });
    return;
  }

  if (status === 202 && body.cvv_refresh_required === true) {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: "cvv_refresh_required",
        approvalUrl:
          typeof body.approval_url === "string" ? body.approval_url : null,
        dispatchResponseJson: JSON.stringify(body),
        decision: "waiting for CVV refresh",
        decisionReason:
          "The stored card security code expired. No order was placed; refresh it before one controlled resend.",
      },
    });
    return;
  }

  if (status === 409) {
    const { figure, cap } = refusalFigures(body, approval);
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: "refused",
        dispatchResponseJson: JSON.stringify(body),
        refusalFigureMinor: figure,
        refusalCapMinor: cap,
        retryabilityKnown: true,
        retryable: true,
        retryAction: "re_preview",
        decision: "refused safely",
        decisionReason: `${String(body.error ?? body.code ?? "price_or_cap_changed")}: Agnic refused before charging. Re-quote and obtain a new approval.`,
      },
    });
    return;
  }

  await prisma.approval.update({
    where: { id: approval.id },
    data: {
      status: "uncertain",
      dispatchResponseJson: JSON.stringify(body),
      decision: "stopped without retry",
      decisionReason: `Dispatch returned HTTP ${status} without an order id. Onyx will not risk a duplicate charge.`,
    },
  });
}

export async function startDispatch(
  approvalId: string,
  mode: "initial" | "resume",
) {
  const allowedStatuses =
    mode === "initial"
      ? ["approved"]
      : ["step_up_approved", "cvv_refresh_required"];
  const claimed = await prisma.approval.updateMany({
    where: { id: approvalId, status: { in: allowedStatuses } },
    data: { status: "dispatching", claimedAt: new Date() },
  });

  if (claimed.count === 0) {
    return {
      claimed: false,
      approval: await prisma.approval.findUnique({ where: { id: approvalId } }),
    };
  }

  const approval = await prisma.approval.findUniqueOrThrow({
    where: { id: approvalId },
  });
  const includeApprovalToken =
    mode === "resume" && approval.approvalToken !== null;

  try {
    const response = await dispatchOrder(
      dispatchPayload(approval, includeApprovalToken),
    );
    await saveDispatchOutcome(approval, response.status, response.body);
  } catch (error) {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        status: "uncertain",
        decision: "stopped without retry",
        decisionReason:
          "The dispatch connection ended without a response. The purchase is uncertain; do not retry and check the card statement.",
      },
    });
    console.error("[Onyx dispatch uncertain]", error);
  }

  return {
    claimed: true,
    approval: await prisma.approval.findUnique({ where: { id: approvalId } }),
  };
}

function approvalCompleted(body: JsonRecord) {
  const status = String(body.status ?? "").toLowerCase();
  return (
    body.approved === true ||
    ["approved", "complete", "completed", "succeeded"].includes(status)
  );
}

function approvalExpired(body: JsonRecord) {
  const status = String(body.status ?? "").toLowerCase();
  return body.expired === true || ["expired", "denied", "rejected"].includes(status);
}

async function refreshStepUp(approval: Approval) {
  if (!approval.approvalToken) return approval;
  const response = await getApprovalStatus(approval.approvalToken);
  if (response.status === 200 && approvalCompleted(response.body)) {
    await prisma.approval.updateMany({
      where: { id: approval.id, status: "approval_required" },
      data: {
        status: "step_up_approved",
        decision: "passkey approved",
        decisionReason:
          "The passkey approval completed. One final dispatch with its approval token is ready.",
      },
    });
  } else if (approvalExpired(response.body)) {
    await prisma.approval.updateMany({
      where: { id: approval.id, status: "approval_required" },
      data: {
        status: "approval_expired",
        decision: "approval expired",
        decisionReason:
          "The passkey approval expired or was declined. No order was placed.",
      },
    });
  }
  return prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
}

const LIVE_ORDER_STATUSES = new Set([
  "pending",
  "dispatched",
  "processing",
  "approval_required",
]);

async function refreshOrder(approval: Approval) {
  if (!approval.agnicOrderId) return approval;
  const response = await getOrder(approval.agnicOrderId);
  if (response.status !== 200) return approval;

  const body = response.body;
  const agnicStatus = String(body.status ?? "processing");
  const evidence = record(body.evidence);
  const hasRetryability = Object.prototype.hasOwnProperty.call(body, "retryable");
  const retryable =
    typeof body.retryable === "boolean" ? body.retryable : null;
  const retryAction =
    typeof body.retry_action === "string" ? body.retry_action : null;
  const screenshotsCount =
    typeof evidence.screenshots_count === "number"
      ? evidence.screenshots_count
      : null;
  const externalEvidenceUrl = [
    evidence.screenshots_url,
    body.screenshots_url,
    body.order_url,
    body.live_view_url,
  ].find((value): value is string => typeof value === "string");

  const common = {
    orderResponseJson: JSON.stringify(body),
    amountChargedMinor:
      typeof body.amount_charged_minor === "number"
        ? body.amount_charged_minor
        : null,
    retryabilityKnown: hasRetryability,
    retryable,
    retryAction,
    evidenceScreenshotsCount: screenshotsCount,
    evidenceUrl:
      externalEvidenceUrl ??
      (screenshotsCount !== null
        ? `/api/dispatch/${approval.id}/evidence`
        : approval.evidenceUrl),
  };

  if (hasRetryability && body.retryable === null) {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        ...common,
        status: "uncertain",
        decision: "stopped without retry",
        decisionReason:
          "Agnic reported retryable:null: money may have moved. Do not retry or auto-refund; check the card statement.",
      },
    });
  } else if (agnicStatus === "succeeded") {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        ...common,
        status: "succeeded",
        decision: "order succeeded",
        decisionReason:
          "The merchant confirmed checkout and Agnic reported a succeeded terminal state.",
      },
    });
    try {
      const evidenceResponse = await getOrderEvidence(approval.agnicOrderId);
      console.log("[Agnic evidence]", evidenceResponse.body);
    } catch (error) {
      console.warn("[Onyx evidence fetch failed]", error);
    }
  } else if (LIVE_ORDER_STATUSES.has(agnicStatus) || retryAction === "poll") {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        ...common,
        status: "processing",
        decision: "polling",
        decisionReason: `Agnic status is ${agnicStatus}; the prescribed action is ${retryAction ?? "poll"}.`,
      },
    });
  } else {
    await prisma.approval.update({
      where: { id: approval.id },
      data: {
        ...common,
        status:
          retryAction === "re_preview" ? "re_preview_required" : agnicStatus,
        decision:
          retryAction === "re_preview"
            ? "new approval required"
            : "order stopped",
        decisionReason:
          typeof body.error_message === "string"
            ? body.error_message
            : `Agnic ended with ${agnicStatus}; no automatic retry was attempted.`,
      },
    });
  }

  return prisma.approval.findUniqueOrThrow({ where: { id: approval.id } });
}

export async function refreshDispatch(approvalId: string) {
  const approval = await prisma.approval.findUnique({
    where: { id: approvalId },
  });
  if (!approval) return null;
  if (approval.status === "approval_required") return refreshStepUp(approval);
  if (approval.agnicOrderId && approval.status === "processing") {
    return refreshOrder(approval);
  }
  return approval;
}
