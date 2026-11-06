import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES, type Row, type Settings, type Template } from "./types";

// Everything stays in chrome.storage.local on this device (API keys are never synced).
export async function loadSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...((settings as Partial<Settings> | undefined) ?? {}) };
}
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}

export async function loadTemplates(): Promise<Template[]> {
  const { templates } = await chrome.storage.local.get("templates");
  return Array.isArray(templates) && templates.length > 0 ? (templates as Template[]) : DEFAULT_TEMPLATES;
}
export async function saveTemplates(templates: Template[]): Promise<void> {
  await chrome.storage.local.set({ templates });
}

export async function loadTable(templateId: string): Promise<Row[]> {
  const key = `table:${templateId}`;
  const data = await chrome.storage.local.get(key);
  return Array.isArray(data[key]) ? (data[key] as Row[]) : [];
}
export async function saveTable(templateId: string, rows: Row[]): Promise<void> {
  await chrome.storage.local.set({ [`table:${templateId}`]: rows });
}
