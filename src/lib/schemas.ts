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

const supplierUrlSchema = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;
    },
    z.string().url("Enter a valid supplier domain or store URL."),
  )
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "Supplier URL must use HTTP or HTTPS.",
  )
  .transform((value) => new URL(value).toString());

export const supplierFormSchema = z.object({
  url: supplierUrlSchema,
});

export type ParsedRequest = z.infer<typeof parsedRequestSchema>;
