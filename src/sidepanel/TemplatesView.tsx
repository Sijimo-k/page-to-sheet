import { useState } from "react";
import { DEFAULT_TEMPLATES, type Template } from "../lib/types";
import { saveTemplates } from "../lib/storage";

interface Props {
  templates: Template[];
  onChange: (templates: Template[]) => void;
}

export function TemplatesView({ templates, onChange }: Props) {
  const [selectedId, setSelectedId] = useState(templates[0].id);
  const [draft, setDraft] = useState<Template>(templates[0]);
  const [message, setMessage] = useState("");

  function select(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSelectedId(id);
    setDraft(structuredClone(t));
    setMessage("");
  }

  async function persist(next: Template[], note: string) {
    await saveTemplates(next);
    onChange(next);
    setMessage(note);
  }

  async function save() {
    const names = draft.columns.map((c) => c.name.trim());
    if (!draft.name.trim()) return setMessage("Give the template a name.");
    if (names.some((n) => !n)) return setMessage("Every column needs a name.");
    if (new Set(names).size !== names.length) return setMessage("Column names must be different.");
    const clean: Template = {
      ...draft,
      name: draft.name.trim(),
      columns: draft.columns.map((c) => ({ name: c.name.trim(), hint: c.hint.trim() })),
      keyColumns: draft.keyColumns.filter((k) => names.includes(k)),
    };
    await persist(
      templates.map((t) => (t.id === clean.id ? clean : t)),
      "Saved. Rows already in this template's table keep their old columns.",
    );
  }

  async function addTemplate() {
    const t: Template = { id: crypto.randomUUID(), name: "New template", columns: [{ name: "Name", hint: "" }], keyColumns: [] };
    await persist([...templates, t], "Template added.");
    setSelectedId(t.id);
    setDraft(structuredClone(t));
  }

  async function removeTemplate() {
    if (templates.length === 1) return setMessage("Keep at least one template.");
    if (!window.confirm(`Delete the template "${draft.name}"?`)) return;
    const next = templates.filter((t) => t.id !== selectedId);
    await persist(next, "Template deleted.");
    select(next[0].id);
    setDraft(structuredClone(next[0]));
    setSelectedId(next[0].id);
  }

  async function resetDefaults() {
    if (!window.confirm("Replace all templates with the three examples?")) return;
    await persist(DEFAULT_TEMPLATES, "Example templates restored.");
    setSelectedId(DEFAULT_TEMPLATES[0].id);
    setDraft(structuredClone(DEFAULT_TEMPLATES[0]));
  }

  function setColumn(i: number, key: "name" | "hint", value: string) {
    const oldName = draft.columns[i].name;
    const columns = draft.columns.map((c, j) => (j === i ? { ...c, [key]: value } : c));
    const keyColumns = key === "name" ? draft.keyColumns.map((k) => (k === oldName ? value : k)) : draft.keyColumns;
    setDraft({ ...draft, columns, keyColumns });
  }

  function toggleKey(name: string) {
    const keyColumns = draft.keyColumns.includes(name) ? draft.keyColumns.filter((k) => k !== name) : [...draft.keyColumns, name];
    setDraft({ ...draft, keyColumns });
  }

  function moveColumn(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= draft.columns.length) return;
    const columns = [...draft.columns];
    [columns[i], columns[j]] = [columns[j], columns[i]];
    setDraft({ ...draft, columns });
  }

  return (
    <div className="stack">
      <label className="field">
        <span>Template</span>
        <select value={selectedId} onChange={(e) => select(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Name</span>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>

      <section className="card">
        <h2>Columns</h2>
        <p className="muted small">The hint tells the AI what to put in the column. Tick "key" on the columns that identify a row; duplicates are judged on those.</p>
        {draft.columns.map((c, i) => (
          <div className="column-row" key={i}>
            <input value={c.name} placeholder="Column name" onChange={(e) => setColumn(i, "name", e.target.value)} aria-label={`Column ${i + 1} name`} />
            <input value={c.hint} placeholder="Hint (optional)" onChange={(e) => setColumn(i, "hint", e.target.value)} aria-label={`Column ${i + 1} hint`} />
            <label className="key" title="Use this column to spot duplicates">
              <input type="checkbox" checked={draft.keyColumns.includes(c.name)} onChange={() => toggleKey(c.name)} /> key
            </label>
            <button className="icon" onClick={() => moveColumn(i, -1)} aria-label="Move up" disabled={i === 0}>
              ↑
            </button>
            <button className="icon" onClick={() => moveColumn(i, 1)} aria-label="Move down" disabled={i === draft.columns.length - 1}>
              ↓
            </button>
            <button
              className="icon"
              onClick={() =>
                setDraft({ ...draft, columns: draft.columns.filter((_, j) => j !== i), keyColumns: draft.keyColumns.filter((k) => k !== c.name) })
              }
              aria-label="Remove column"
              disabled={draft.columns.length === 1}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={() => setDraft({ ...draft, columns: [...draft.columns, { name: "", hint: "" }] })}>Add column</button>
      </section>

      <div className="row-buttons">
        <button className="primary" onClick={save}>
          Save template
        </button>
        <button onClick={addTemplate}>New template</button>
        <button className="danger" onClick={removeTemplate}>
          Delete
        </button>
      </div>
      <button className="link" onClick={resetDefaults}>
        Restore the example templates
      </button>
      {message && <p className="status info">{message}</p>}
    </div>
  );
}
