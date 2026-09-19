"use server";

import { parseSupplyRequest } from "@/lib/llm";
import { prisma } from "@/lib/prisma";
import { requestFormSchema, type ParsedRequest } from "@/lib/schemas";

export type RequestActionState = {
  ok: boolean;
  message: string;
  requestId?: number;
  parsed?: ParsedRequest;
};

export async function parseRequest(
  _previous: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const form = requestFormSchema.safeParse({
    rawText: formData.get("rawText"),
  });
  if (!form.success) {
    return { ok: false, message: form.error.issues[0].message };
  }

  try {
    const parsed = await parseSupplyRequest(form.data.rawText);
    const saved = await prisma.request.create({
      data: {
        rawText: form.data.rawText,
        parsedJson: JSON.stringify(parsed),
        budgetMinor: parsed.budget_minor,
      },
    });

    return {
      ok: true,
      message: "Request parsed and stored.",
      requestId: saved.id,
      parsed,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
