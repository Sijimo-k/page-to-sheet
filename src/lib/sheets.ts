import type { Row } from "./types";

export interface SheetResult {
  appended: number;
  skipped: number;
}

export function isAppsScriptUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.trim());
}

/** Send rows to the user's own Apps Script web app (see apps-script/Code.gs). */
export async function sendToSheet(
  url: string,
  token: string,
  sheetName: string,
  columns: string[],
  keyColumns: string[],
  rows: Row[],
): Promise<SheetResult> {
  if (!isAppsScriptUrl(url)) {
    throw new Error("The Apps Script URL should look like https://script.google.com/macros/s/.../exec");
  }
  let res: Response;
  try {
    res = await fetch(url.trim(), {
      method: "POST",
      // text/plain keeps this a simple request for Apps Script.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, sheetName, columns, keyColumns, rows }),
    });
  } catch {
    throw new Error("Could not reach the Apps Script web app.");
  }
  const text = await res.text();
  let body: { ok?: boolean; appended?: number; skipped?: number; error?: string };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("The Apps Script did not answer with JSON. Check that it is deployed with access 'Anyone'.");
  }
  if (!body.ok) throw new Error(`Sheet error: ${body.error ?? "unknown"}`);
  return { appended: body.appended ?? 0, skipped: body.skipped ?? 0 };
}
