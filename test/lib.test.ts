import { describe, expect, it } from "vitest";
import { keyColumnsOf, mergeRows, normalizeValue, rowKey } from "../src/lib/dedupe";
import { toCsv } from "../src/lib/csv";
import { buildInstructions, normalizeRows } from "../src/lib/rows";
import { isAppsScriptUrl } from "../src/lib/sheets";
import { DEFAULT_TEMPLATES, type Template } from "../src/lib/types";

const products = DEFAULT_TEMPLATES[0];

describe("dedupe", () => {
  it("normalizes case, width and whitespace", () => {
    expect(normalizeValue("  Ｍｉｎｔ   Tea \n")).toBe("mint tea");
  });

  it("uses the template's key columns, or all columns when none are set", () => {
    expect(keyColumnsOf(products)).toEqual(["Name"]);
    const noKeys: Template = { ...products, keyColumns: [] };
    expect(keyColumnsOf(noKeys)).toEqual(["Name", "Price", "Availability", "URL"]);
    const staleKey: Template = { ...products, keyColumns: ["Removed column"] };
    expect(keyColumnsOf(staleKey)).toHaveLength(4);
  });

  it("gives the same key to cosmetically different rows", () => {
    expect(rowKey({ Name: "Mint Tea" }, ["Name"])).toBe(rowKey({ Name: " mint  tea" }, ["Name"]));
    expect(rowKey({ Name: "Mint Tea" }, ["Name"])).not.toBe(rowKey({ Name: "Mint Teas" }, ["Name"]));
  });

  it("running the same extraction twice adds nothing the second time", () => {
    const batch = [
      { Name: "Mint Tea", Price: "$4" },
      { Name: "Black Tea", Price: "$5" },
    ];
    const first = mergeRows([], batch, ["Name"]);
    expect(first).toMatchObject({ added: 2, duplicates: 0 });
    const second = mergeRows(first.rows, batch, ["Name"]);
    expect(second).toMatchObject({ added: 0, duplicates: 2 });
    expect(second.rows).toHaveLength(2);
  });

  it("skips repeats inside one batch but keeps rows with empty keys", () => {
    const r = mergeRows([], [{ Name: "A" }, { Name: "a " }, { Name: "" }, { Name: "" }], ["Name"]);
    expect(r).toMatchObject({ added: 3, duplicates: 1 });
  });
});

describe("csv", () => {
  it("adds a BOM, quotes special characters and blocks formulas", () => {
    const csv = toCsv(["Name", "Note"], [{ Name: 'Say "hi", world', Note: "=HYPERLINK(1)" }, { Name: "Line\nbreak" }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Say ""hi"", world"');
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"Line\nbreak",\r\n');
  });
});

describe("rows", () => {
  const columns = products.columns;

  it("keeps exactly the template columns and stringifies values", () => {
    const rows = normalizeRows({ rows: [{ Name: " Tea ", Price: 4, Extra: "x" }] }, columns);
    expect(rows).toEqual([{ Name: "Tea", Price: "4", Availability: "", URL: "" }]);
  });

  it("accepts a bare array and drops empty rows", () => {
    expect(normalizeRows([{ Name: "" }, null, { Name: "Tea" }], columns)).toHaveLength(1);
  });

  it("rejects output that is not a list of rows", () => {
    expect(() => normalizeRows({ items: [] }, columns)).toThrow();
  });

  it("lists every column with its hint in the instructions", () => {
    const text = buildInstructions(columns);
    expect(text).toContain("- Price: price as shown, with currency");
    expect(text).toContain("never guess");
  });
});

describe("sheets", () => {
  it("accepts only Apps Script web app URLs", () => {
    expect(isAppsScriptUrl("https://script.google.com/macros/s/AKfycb-x_1/exec")).toBe(true);
    expect(isAppsScriptUrl("https://script.google.com/macros/s/AKfycb/dev")).toBe(false);
    expect(isAppsScriptUrl("https://evil.example.com/macros/s/x/exec")).toBe(false);
  });
});
