import type { Column, PageLink, Row, StruckText } from "./types";

/**
 * Turn whatever the model returned into clean rows that have exactly the template's columns.
 * Unknown keys are dropped, missing ones become "", non-strings are stringified.
 */
export function normalizeRows(raw: unknown, columns: Column[]): Row[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { rows?: unknown }).rows)
      ? (raw as { rows: unknown[] }).rows
      : null;
  if (!list) throw new Error("The model did not return a list of rows.");
  const out: Row[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const row: Row = {};
    for (const col of columns) {
      const v = source[col.name];
      row[col.name] = v === null || v === undefined ? "" : typeof v === "string" ? v.trim() : String(v);
    }
    if (Object.values(row).some((v) => v !== "")) out.push(row);
  }
  return out;
}

/** Instructions shared by both providers. */
export function buildInstructions(columns: Column[]): string {
  const list = columns.map((c) => `- ${c.name}${c.hint ? `: ${c.hint}` : ""}`).join("\n");
  return [
    "You extract structured rows from the text of a web page.",
    "Return one row per item that appears on the page, with exactly these fields:",
    list,
    "Copy values as they appear on the page. Use an empty string when a field is not on the page; never guess or invent values.",
    "Ignore navigation, ads, cookie banners and footers. If the page has no matching items, return an empty list.",
    "For link or URL fields, use the matching entry in <links> (the link whose text is the item's name or a 'details' link next to it). Never build a URL yourself.",
    "Text listed in <struck_through> is crossed out on the page (usually an old price). Do not use it as the current value.",
  ].join("\n");
}

export function buildUserContent(page: {
  title: string;
  url: string;
  text: string;
  links?: PageLink[];
  struck?: StruckText[];
}): string {
  const parts = [`Page title: ${page.title}\nPage URL: ${page.url}`, `<page_text>\n${page.text}\n</page_text>`];
  if (page.links?.length) {
    parts.push(`<links>\n${page.links.map((l) => `${l.text} -> ${l.href}`).join("\n")}\n</links>`);
  }
  if (page.struck?.length) {
    parts.push(`<struck_through>\n${page.struck.map((s) => `"${s.text}" in: ${s.context}`).join("\n")}\n</struck_through>`);
  }
  return parts.join("\n\n");
}
