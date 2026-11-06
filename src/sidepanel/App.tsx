import { useEffect, useState } from "react";
import type { Settings, Template } from "../lib/types";
import { loadSettings, loadTemplates } from "../lib/storage";
import { ExtractView } from "./ExtractView";
import { TemplatesView } from "./TemplatesView";
import { SettingsView } from "./SettingsView";

type Tab = "extract" | "templates" | "settings";

export function App() {
  const [tab, setTab] = useState<Tab>("extract");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    void Promise.all([loadSettings(), loadTemplates()]).then(([s, t]) => {
      setSettings(s);
      setTemplates(t);
    });
  }, []);

  if (!settings || !templates) return <p className="muted pad">Loading…</p>;

  return (
    <div className="app">
      <nav className="tabs" role="tablist">
        {(["extract", "templates", "settings"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "extract" ? "Extract" : t === "templates" ? "Templates" : "Settings"}
          </button>
        ))}
      </nav>
      <main className="pad">
        {tab === "extract" && (
          <ExtractView settings={settings} templates={templates} openSettings={() => setTab("settings")} />
        )}
        {tab === "templates" && <TemplatesView templates={templates} onChange={setTemplates} />}
        {tab === "settings" && <SettingsView settings={settings} onSaved={setSettings} />}
      </main>
    </div>
  );
}
