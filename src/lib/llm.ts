import "server-only";

import { parsedRequestSchema, type ParsedRequest } from "./schemas";

const SYSTEM_PROMPT = `You convert a cafe supply request into structured data.
Return STRICT JSON only: no markdown, code fences, commentary, or extra keys.
The exact shape is:
{"items":[{"query":"string","quantity":1}],"budget_minor":10000,"currency":"CAD","notes":"string"}
Money must be integer minor units. Infer CAD only when the user does not specify a currency.
Preserve uncertainty in notes instead of inventing product details.`;

type TextToJsonProvider = {
  complete(input: {
    system: string;
    user: string;
    model: string;
  }): Promise<string>;
};

function runtimeProvider(): TextToJsonProvider {
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.LLM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY (or LLM_API_KEY) is not configured in .env",
    );
  }
  const baseUrl = (
    process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1"
  ).replace(/\/+$/, "");

  return {
    async complete({ system, user, model }) {
      const openRouterModel =
        model === "claude-sonnet-4-6"
          ? "anthropic/claude-sonnet-4.6"
          : model;
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Onyx",
          ...(process.env.OPENROUTER_SITE_URL
            ? { "HTTP-Referer": process.env.OPENROUTER_SITE_URL }
            : {}),
        },
        body: JSON.stringify({
          model: openRouterModel,
          max_tokens: 1_024,
          temperature: 0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        cache: "no-store",
      });

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(
          `OpenRouter HTTP ${response.status}: ${
            body.error?.message ?? "request failed"
          }`,
        );
      }

      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("OpenRouter returned no text completion.");
      }
      return content;
    },
  };
}

export async function parseSupplyRequest(rawText: string): Promise<ParsedRequest> {
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not configured in .env");

  const text = await runtimeProvider().complete({
    system: SYSTEM_PROMPT,
    user: rawText,
    model,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`LLM returned invalid JSON: ${text.slice(0, 300)}`);
  }

  return parsedRequestSchema.parse(parsed);
}
