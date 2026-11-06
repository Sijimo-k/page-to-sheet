import { useState } from "react";
import type { Provider, Settings } from "../lib/types";
import { saveSettings } from "../lib/storage";
import { isAppsScriptUrl } from "../lib/sheets";

interface Props {
  settings: Settings;
  onSaved: (settings: Settings) => void;
}

export function SettingsView({ settings, onSaved }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [message, setMessage] = useState("");

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setDraft({ ...draft, [key]: value });
    setMessage("");
  }

  async function save() {
    const clean: Settings = {
      ...draft,
      claudeKey: draft.claudeKey.trim(),
      openaiKey: draft.openaiKey.trim(),
      claudeModel: draft.claudeModel.trim(),
      openaiModel: draft.openaiModel.trim(),
      sheetUrl: draft.sheetUrl.trim(),
      sheetToken: draft.sheetToken.trim(),
      sheetName: draft.sheetName.trim() || "Page to Sheet",
    };
    if (clean.sheetUrl && !isAppsScriptUrl(clean.sheetUrl)) {
      setMessage("The Apps Script URL should look like https://script.google.com/macros/s/.../exec");
      return;
    }
    await saveSettings(clean);
    onSaved(clean);
    setDraft(clean);
    setMessage("Saved on this device.");
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>AI</h2>
        <fieldset className="radios">
          <legend className="small muted">Which AI reads the page</legend>
          {(["claude", "openai"] as Provider[]).map((p) => (
            <label key={p}>
              <input type="radio" name="provider" checked={draft.provider === p} onChange={() => set("provider", p)} />
              {p === "claude" ? "Claude (Anthropic)" : "OpenAI"}
            </label>
          ))}
        </fieldset>
        {draft.provider === "claude" ? (
          <>
            <label className="field">
              <span>Claude API key</span>
              <input type="password" autoComplete="off" value={draft.claudeKey} onChange={(e) => set("claudeKey", e.target.value)} placeholder="sk-ant-…" />
            </label>
            <label className="field">
              <span>Model</span>
              <input value={draft.claudeModel} onChange={(e) => set("claudeModel", e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span>OpenAI API key</span>
              <input type="password" autoComplete="off" value={draft.openaiKey} onChange={(e) => set("openaiKey", e.target.value)} placeholder="sk-…" />
            </label>
            <label className="field">
              <span>Model</span>
              <input value={draft.openaiModel} onChange={(e) => set("openaiModel", e.target.value)} />
            </label>
          </>
        )}
        <p className="muted small">Keys are stored only on this device and sent only to the AI you choose. Usage is billed to your own account.</p>
      </section>

      <section className="card">
        <h2>Google Sheet (optional)</h2>
        <p className="muted small">
          Deploy the small Apps Script from the README as a web app, then paste its URL and the same token here. Rows go only to your own sheet.
        </p>
        <label className="field">
          <span>Apps Script web app URL</span>
          <input value={draft.sheetUrl} onChange={(e) => set("sheetUrl", e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
        </label>
        <label className="field">
          <span>Token</span>
          <input type="password" autoComplete="off" value={draft.sheetToken} onChange={(e) => set("sheetToken", e.target.value)} />
        </label>
        <label className="field">
          <span>Sheet (tab) name</span>
          <input value={draft.sheetName} onChange={(e) => set("sheetName", e.target.value)} />
        </label>
      </section>

      <button className="primary" onClick={save}>
        Save settings
      </button>
      {message && <p className="status info">{message}</p>}
    </div>
  );
}
