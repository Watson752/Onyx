import { z } from "zod";

export const parsedRequestSchema = z.object({
  items: z
    .array(
      z.object({
        query: z.string().trim().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  budget_minor: z.number().int().positive(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  notes: z.string(),
});

export const requestFormSchema = z.object({
  rawText: z.string().trim().min(3, "Describe at least one item."),
});

export const supplierFormSchema = z.object({
  url: z.string().trim().url("Enter a complete store URL."),
});

export type ParsedRequest = z.infer<typeof parsedRequestSchema>;
