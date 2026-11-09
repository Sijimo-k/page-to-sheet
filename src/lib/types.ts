export interface Column {
  name: string;
  /** Optional hint for the model, e.g. "price with currency symbol". */
  hint: string;
}

export interface Template {
  id: string;
  name: string;
  columns: Column[];
  /** Columns that identify a row. Empty means "all columns". */
  keyColumns: string[];
}

export type Row = Record<string, string>;

export type Provider = "claude" | "openai";

export interface Settings {
  provider: Provider;
  claudeModel: string;
  openaiModel: string;
  claudeKey: string;
  openaiKey: string;
  sheetUrl: string;
  sheetToken: string;
  sheetName: string;
}

export interface PageText {
  title: string;
  url: string;
  text: string;
  /** True when the text was cut to the size limit. */
  truncated: boolean;
  fromSelection: boolean;
  /** Visible links (text -> absolute URL). innerText drops hrefs, so URL columns need these. */
  links: PageLink[];
  /** Visible struck-through text (<s>, <del>, <strike>), usually old prices. innerText hides the strike. */
  struck: StruckText[];
}

export interface PageLink {
  text: string;
  href: string;
}

export interface StruckText {
  text: string;
  /** Text of the surrounding element, so the model can tell which item it belongs to. */
  context: string;
}

export const DEFAULT_SETTINGS: Settings = {
  provider: "claude",
  claudeModel: "claude-opus-5-5",
  openaiModel: "gpt-4o-mini",
  claudeKey: "",
  openaiKey: "",
  sheetUrl: "",
  sheetToken: "",
  sheetName: "Page to Sheet",
};

export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "products",
    name: "Products",
    columns: [
      { name: "Name", hint: "product name" },
      { name: "Price", hint: "current price with currency; if an old price is struck through, use the new one" },
      { name: "Availability", hint: "in stock, sold out, preorder, etc." },
      { name: "URL", hint: "link to the product page if visible" },
    ],
    keyColumns: ["Name"],
  },
  {
    id: "events",
    name: "Events",
    columns: [
      { name: "Title", hint: "" },
      { name: "Date", hint: "YYYY-MM-DD if the year is known" },
      { name: "Time", hint: "start time with timezone if shown" },
      { name: "Venue", hint: "place or 'Online'" },
      { name: "Price", hint: "'Free' if free" },
    ],
    keyColumns: ["Title", "Date"],
  },
  {
    id: "directory",
    name: "Business directory",
    columns: [
      { name: "Business", hint: "business name" },
      { name: "Category", hint: "" },
      { name: "Phone", hint: "" },
      { name: "Address", hint: "" },
      { name: "Website", hint: "" },
    ],
    keyColumns: ["Business"],
  },
];
