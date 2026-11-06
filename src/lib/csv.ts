import type { Row } from "./types";

function escapeCell(value: string): string {
  // Neutralise spreadsheet formula injection from page text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV with a UTF-8 BOM so Excel opens non-ASCII text correctly. */
export function toCsv(columns: string[], rows: Row[]): string {
  const lines = [columns.map(escapeCell).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(row[c] ?? "")).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
