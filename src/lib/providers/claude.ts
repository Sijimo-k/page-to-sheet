import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Column, PageText, Row } from "../types";
import { buildInstructions, buildUserContent, normalizeRows } from "../rows";

function rowsSchema(columns: Column[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const c of columns) shape[c.name] = z.string();
  return z.object({ rows: z.array(z.object(shape)) });
}

export async function extractWithClaude(
  apiKey: string,
  model: string,
  columns: Column[],
  page: PageText,
): Promise<Row[]> {
  // The key is the user's own and is only sent to api.anthropic.com.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      // On a policy decline, let the API retry on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: buildInstructions(columns),
      messages: [{ role: "user", content: buildUserContent(page) }],
      output_config: { format: betaZodOutputFormat(rowsSchema(columns)) },
    });
    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined to process this page.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("The page has more items than fit in one answer. Select part of the page and try again.");
    }
    if (!response.parsed_output) throw new Error("Claude returned no rows.");
    return normalizeRows(response.parsed_output, columns);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new Error("Claude rejected the API key. Check it in Settings.");
    if (error instanceof Anthropic.PermissionDeniedError) throw new Error("This API key cannot use that model.");
    if (error instanceof Anthropic.NotFoundError) throw new Error(`Model "${model}" was not found. Check it in Settings.`);
    if (error instanceof Anthropic.RateLimitError) throw new Error("Claude rate limit reached. Wait a moment and try again.");
    if (error instanceof Anthropic.APIConnectionError) throw new Error("Could not reach Claude. Check your connection.");
    if (error instanceof Anthropic.APIError) throw new Error(`Claude API error ${error.status ?? ""}: ${error.message}`);
    throw error;
  }
}
