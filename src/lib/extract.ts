import type { Column, PageText, Row, Settings } from "./types";
import { extractWithClaude } from "./providers/claude";
import { extractWithOpenAI } from "./providers/openai";

export class MissingKeyError extends Error {}

export async function extractRows(settings: Settings, columns: Column[], page: PageText): Promise<Row[]> {
  if (columns.length === 0) throw new Error("Add at least one column to the template.");
  if (settings.provider === "claude") {
    if (!settings.claudeKey) throw new MissingKeyError("Add your Claude API key in Settings first.");
    return extractWithClaude(settings.claudeKey, settings.claudeModel, columns, page);
  }
  if (!settings.openaiKey) throw new MissingKeyError("Add your OpenAI API key in Settings first.");
  return extractWithOpenAI(settings.openaiKey, settings.openaiModel, columns, page);
}
