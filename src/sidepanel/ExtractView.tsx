import { useEffect, useState } from "react";
import type { Row, Settings, Template } from "../lib/types";
import { extractRows, MissingKeyError } from "../lib/extract";
import { ensureSiteAccess, getActiveTab, readActivePage } from "../lib/page";
import { keyColumnsOf, mergeRows } from "../lib/dedupe";
import { loadTable, saveTable } from "../lib/storage";
import { toCsv } from "../lib/csv";
import { isAppsScriptUrl, sendToSheet } from "../lib/sheets";
import { RowsTable } from "./RowsTable";

interface Props {
  settings: Settings;
  templates: Template[];
  openSettings: () => void;
}

type Status = { kind: "info" | "error" | "ok"; text: string } | null;

export function ExtractView({ settings, templates, openSettings }: Props) {
  const [templateId, setTemplateId] = useState(templates[0].id);
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const columns = template.columns.map((c) => c.name);

  const [table, setTable] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [needsKey, setNeedsKey] = useState(false);

  useEffect(() => {
    setPending(null);
    setStatus(null);
    void loadTable(template.id).then(setTable);
  }, [template.id]);

  async function updateTable(rows: Row[]) {
    setTable(rows);
    await saveTable(template.id, rows);
  }

  async function runExtract(selectionOnly: boolean) {
    setStatus(null);
    setNeedsKey(false);
    try {
      const tab = await getActiveTab();
      // Asked per site, only when the user clicks.
      if (!(await ensureSiteAccess(tab.url!))) {
        setStatus({ kind: "error", text: "Permission to read this site was not granted." });
        return;
      }
      setBusy(true);
      setStatus({ kind: "info", text: "Reading the page and asking the AI…" });
      const page = await readActivePage(tab, selectionOnly);
      const rows = await extractRows(settings, template.columns, page);
      setPending(rows);
      const parts = [`Found ${rows.length} row${rows.length === 1 ? "" : "s"}${page.fromSelection ? " in the selection" : ""}. Review them, then add to the table.`];
      if (page.truncated) parts.push("The page was long, so only the first part was read. Select a section to read the rest.");
      setStatus({ kind: rows.length ? "info" : "error", text: rows.length ? parts.join(" ") : "No matching items were found on this page." });
    } catch (error) {
      if (error instanceof MissingKeyError) setNeedsKey(true);
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const result = mergeRows(table, pending, keyColumnsOf(template));
    await updateTable(result.rows);
    setPending(null);
    setStatus({
      kind: "ok",
      text: `Added ${result.added} row${result.added === 1 ? "" : "s"}${result.duplicates ? `, skipped ${result.duplicates} already in the table` : ""}.`,
    });
  }

  function downloadCsv() {
    const blob = new Blob([toCsv(columns, table)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.name.replace(/[^\w-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function sendSheet() {
    setStatus(null);
    setBusy(true);
    try {
      const r = await sendToSheet(settings.sheetUrl, settings.sheetToken, settings.sheetName, columns, keyColumnsOf(template), table);
      setStatus({ kind: "ok", text: `Sheet updated: ${r.appended} new row${r.appended === 1 ? "" : "s"}, ${r.skipped} already there.` });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  }

  async function clearTable() {
    if (table.length && !window.confirm(`Remove all ${table.length} rows from this table?`)) return;
    await updateTable([]);
    setStatus(null);
  }

  return (
    <div className="stack">
      <label className="field">
        <span>Template</span>
        <select value={template.id} onChange={(e) => setTemplateId(e.target.value)} disabled={busy}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.columns.length} columns)
            </option>
          ))}
        </select>
      </label>

      <div className="row-buttons">
        <button className="primary" onClick={() => runExtract(false)} disabled={busy}>
          Extract from page
        </button>
        <button onClick={() => runExtract(true)} disabled={busy}>
          From selection
        </button>
      </div>
      <p className="muted small">
        Sends the visible text of the current tab to {settings.provider === "claude" ? "Claude" : "OpenAI"} only when you click.
      </p>

      {status && (
        <p className={`status ${status.kind}`} role="status">
          {status.text}
          {needsKey && (
            <>
              {" "}
              <button className="link" onClick={openSettings}>
                Open Settings
              </button>
            </>
          )}
        </p>
      )}

      {pending && (
        <section className="card pending">
          <h2>Review ({pending.length})</h2>
          <RowsTable columns={columns} rows={pending} onChange={setPending} highlightEmpty />
          <div className="row-buttons">
            <button className="primary" onClick={confirmPending} disabled={!pending.length}>
              Add to table
            </button>
            <button onClick={() => setPending(null)}>Discard</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>
          Table ({table.length} row{table.length === 1 ? "" : "s"})
        </h2>
        {table.length ? (
          <RowsTable columns={columns} rows={table} onChange={(rows) => void updateTable(rows)} />
        ) : (
          <p className="muted small">Rows you add appear here. Extract from more pages to keep adding; duplicates are skipped.</p>
        )}
        <div className="row-buttons">
          <button onClick={downloadCsv} disabled={!table.length}>
            Download CSV
          </button>
          <button onClick={sendSheet} disabled={busy || !table.length || !isAppsScriptUrl(settings.sheetUrl)} title={isAppsScriptUrl(settings.sheetUrl) ? "" : "Set up the Apps Script URL in Settings"}>
            Send to Google Sheet
          </button>
          <button className="danger" onClick={clearTable} disabled={!table.length}>
            Clear
          </button>
        </div>
      </section>
    </div>
  );
}
