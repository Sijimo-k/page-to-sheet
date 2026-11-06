import type { Row, Template } from "./types";

/** Lower-case, trim and collapse whitespace so cosmetic differences do not create duplicates. */
export function normalizeValue(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 32-bit FNV-1a, enough to tell rows apart inside one table. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function keyColumnsOf(template: Template): string[] {
  const names = template.columns.map((c) => c.name);
  const keys = template.keyColumns.filter((k) => names.includes(k));
  return keys.length > 0 ? keys : names;
}

export function rowKey(row: Row, keyColumns: string[]): string {
  return fnv1a(keyColumns.map((c) => normalizeValue(row[c] ?? "")).join("␟"));
}

/** A row with no value in any key column cannot be identified, so it is never treated as a duplicate. */
function isEmptyKey(row: Row, keyColumns: string[]): boolean {
  return keyColumns.every((c) => normalizeValue(row[c] ?? "") === "");
}

export interface MergeResult {
  rows: Row[];
  added: number;
  duplicates: number;
}

/** Append incoming rows that are not already in the table (and not repeated within the batch). */
export function mergeRows(existing: Row[], incoming: Row[], keyColumns: string[]): MergeResult {
  const seen = new Set(existing.filter((r) => !isEmptyKey(r, keyColumns)).map((r) => rowKey(r, keyColumns)));
  const rows = [...existing];
  let added = 0;
  let duplicates = 0;
  for (const row of incoming) {
    if (isEmptyKey(row, keyColumns)) {
      rows.push(row);
      added++;
      continue;
    }
    const key = rowKey(row, keyColumns);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    rows.push(row);
    added++;
  }
  return { rows, added, duplicates };
}
