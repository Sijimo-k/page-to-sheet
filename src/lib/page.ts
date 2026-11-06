import type { PageText } from "./types";

export const MAX_PAGE_CHARS = 60_000;

/**
 * Runs inside the page via chrome.scripting.executeScript, so it must be self-contained.
 * innerText only returns rendered text: form field values (including passwords) are not included.
 */
function readPage(maxChars: number, selectionOnly: boolean) {
  const selection = window.getSelection()?.toString().trim() ?? "";
  const useSelection = selectionOnly && selection.length > 0;
  const raw = useSelection ? selection : (document.body?.innerText ?? "");
  const text = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    title: document.title,
    url: location.href,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    fromSelection: useSelection,
  };
}

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) throw new Error("No active tab found.");
  if (!/^https?:/.test(tab.url)) throw new Error("This page cannot be read. Open a normal web page (http or https).");
  return tab;
}

/** Ask for access to just this site. Must be called from a user click. */
export async function ensureSiteAccess(url: string): Promise<boolean> {
  const origin = `${new URL(url).origin}/*`;
  if (await chrome.permissions.contains({ origins: [origin] })) return true;
  return chrome.permissions.request({ origins: [origin] });
}

export async function readActivePage(tab: chrome.tabs.Tab, selectionOnly: boolean): Promise<PageText> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: readPage,
    args: [MAX_PAGE_CHARS, selectionOnly],
  });
  const page = result?.result as PageText | undefined;
  if (!page) throw new Error("Could not read this page.");
  if (!page.text) throw new Error(selectionOnly ? "Select some text on the page first." : "This page has no readable text.");
  return page;
}
