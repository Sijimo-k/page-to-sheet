import type { Column, PageText, Row } from "../types";
import { buildInstructions, buildUserContent, normalizeRows } from "../rows";

function rowsJsonSchema(columns: Column[]) {
  const properties: Record<string, { type: "string" }> = {};
  for (const c of columns) properties[c.name] = { type: "string" };
  return {
    type: "object",
    properties: {
      rows: {
        type: "array",
        items: { type: "object", properties, required: columns.map((c) => c.name), additionalProperties: false },
      },
    },
    required: ["rows"],
    additionalProperties: false,
  };
}

interface ChatResponse {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  error?: { message?: string };
}

export async function extractWithOpenAI(
  apiKey: string,
  model: string,
  columns: Column[],
  page: PageText,
): Promise<Row[]> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildInstructions(columns) },
          { role: "user", content: buildUserContent(page) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "rows", strict: true, schema: rowsJsonSchema(columns) } },
      }),
    });
  } catch {
    throw new Error("Could not reach OpenAI. Check your connection.");
  }
  const body = (await res.json().catch(() => ({}))) as ChatResponse;
  if (res.status === 401) throw new Error("OpenAI rejected the API key. Check it in Settings.");
  if (res.status === 404) throw new Error(`Model "${model}" was not found. Check it in Settings.`);
  if (res.status === 429) throw new Error("OpenAI rate limit or quota reached. Wait a moment and try again.");
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${body.error?.message ?? res.statusText}`);
  const choice = body.choices?.[0];
  if (choice?.message?.refusal) throw new Error("OpenAI declined to process this page.");
  if (choice?.finish_reason === "length") {
    throw new Error("The page has more items than fit in one answer. Select part of the page and try again.");
  }
  const content = choice?.message?.content;
  if (!content) throw new Error("OpenAI returned no rows.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned text that is not valid JSON.");
  }
  return normalizeRows(parsed, columns);
}
