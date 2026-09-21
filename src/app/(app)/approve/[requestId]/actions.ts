"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const cartSchema = z
  .object({
    merchantId: z.string().min(1),
    supplierName: z.string().min(1),
    items: z.array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    ),
    displayItems: z.array(
      z.object({
        title: z.string(),
        query: z.string(),
        sku: z.string(),
        quantity: z.number().int().positive(),
      }),
    ),
    addressMode: z.enum(["ship_to", "cardholder", "pickup"]),
    shipTo: z.record(z.string(), z.unknown()).optional(),
    constraints: z.object({
      max_total_minor: z.number().int().nonnegative(),
      max_shipping_minor: z.number().int().nonnegative(),
    }),
    amountMinor: z.number().int().nonnegative(),
    amountIsFinal: z.boolean(),
    currency: z.string().length(3),
    fulfillmentOptionId: z.string().optional(),
    fulfillmentOption: z
      .object({
        type: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((cart, context) => {
    if (cart.addressMode === "ship_to" && !cart.shipTo) {
      context.addIssue({
        code: "custom",
        path: ["shipTo"],
        message: "ship_to mode requires the approved destination",
      });
    }
    if (cart.addressMode === "pickup" && !cart.fulfillmentOptionId) {
      context.addIssue({
        code: "custom",
        path: ["fulfillmentOptionId"],
        message: "pickup mode requires a selected fulfilment option",
      });
    }
  });

const confirmationSchema = z.object({
  confirmationText: z.string().trim().min(3),
  understandsCharge: z.literal("yes"),
});

export async function confirmApproval(batchId: string, formData: FormData) {
  const confirmation = confirmationSchema.safeParse({
    confirmationText: formData.get("confirmationText"),
    understandsCharge: formData.get("understandsCharge"),
  });
  if (!confirmation.success) {
    throw new Error("Enter an affirmative confirmation and check the charge box.");
  }

  const batch = await prisma.approvalBatch.findUnique({
    where: { id: batchId },
    include: { request: true },
  });
  if (!batch) throw new Error("This approval preview no longer exists.");

  const carts = z.array(cartSchema).parse(JSON.parse(batch.cartsJson));
  const approvedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.approvalBatch.updateMany({
      where: { id: batch.id, confirmedAt: null },
      data: {
        confirmedAt: approvedAt,
        confirmationText: confirmation.data.confirmationText,
      },
    });

    if (claimed.count === 0) return;

    await tx.approval.createMany({
      data: carts.map((cart) => ({
        batchId: batch.id,
        requestId: batch.requestId,
        supplierName: cart.supplierName,
        merchantId: cart.merchantId,
        itemsJson: JSON.stringify(cart.items),
        displayItemsJson: JSON.stringify(cart.displayItems),
        addressMode: cart.addressMode,
        shipToJson:
          cart.addressMode === "ship_to"
            ? JSON.stringify(cart.shipTo)
            : null,
        constraintsJson: JSON.stringify(cart.constraints),
        amountMinor: cart.amountMinor,
        currency: cart.currency,
        fulfillmentOptionId: cart.fulfillmentOptionId,
        userPrompt: batch.request.rawText,
        userConfirmationText: confirmation.data.confirmationText,
        userApprovedAt: approvedAt,
        status: "approved",
      })),
    });
  });

  redirect(`/dispatch/${batch.id}`);
}
