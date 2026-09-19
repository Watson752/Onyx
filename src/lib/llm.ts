import "server-only";

import Anthropic from "@anthropic-ai/sdk";

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured in .env");
  }

  const client = new Anthropic({ apiKey });
  return {
    async complete({ system, user, model }) {
      const message = await client.messages.create({
        model,
        max_tokens: 1_024,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
      });

      return message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
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
