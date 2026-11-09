import type { PageText } from "./types";

export const MAX_PAGE_CHARS = 60_000;

/**
 * Runs inside the page via chrome.scripting.executeScript, so it must be self-contained.
 * innerText only returns rendered text: form field values (including passwords) are not included.
 */
function readPage(maxChars: number, selectionOnly: boolean) {
  const MAX_LINKS = 300;
  const MAX_STRUCK = 100;
  const sel = window.getSelection();
  const selection = sel?.toString().trim() ?? "";
  const useSelection = selectionOnly && selection.length > 0;
  const raw = useSelection ? selection : (document.body?.innerText ?? "");
  const text = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const visible = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const inScope = (el: Element) => !useSelection || Boolean(sel?.containsNode(el, true));
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();

  const links: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    if (links.length >= MAX_LINKS) break;
    const href = (a as HTMLAnchorElement).href;
    const label = clean((a as HTMLElement).innerText || a.getAttribute("aria-label") || "");
    if (!/^https?:/.test(href) || !label || !visible(a) || !inScope(a)) continue;
    const key = `${label}\n${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ text: label.slice(0, 120), href });
  }

  const struck: { text: string; context: string }[] = [];
  for (const el of Array.from(document.querySelectorAll("s, del, strike"))) {
    if (struck.length >= MAX_STRUCK) break;
    const value = clean((el as HTMLElement).innerText);
    if (!value || !visible(el) || !inScope(el)) continue;
    const around = el.closest("li, tr, article, [class*=card], [class*=item], [class*=product]") ?? el.parentElement;
    struck.push({ text: value.slice(0, 80), context: clean((around as HTMLElement | null)?.innerText ?? "").slice(0, 160) });
  }

  return {
    title: document.title,
    url: location.href,
    text: text.slice(0, maxChars),
    truncated: text.length > maxChars,
    fromSelection: useSelection,
    links,
    struck,
  };
}

export async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found.");
  // Without the "tabs" permission Chrome only reveals the URL of a tab the user clicked the toolbar icon on
  // (activeTab) or of a site already allowed. We keep it that way on purpose, so explain the one extra click.
  if (!tab.url) {
    throw new Error(
      "Chrome has not given Page to Sheet access to this tab yet. Click the Page to Sheet icon in the toolbar " +
        "while this page is open, then click Extract again. You only need to do this once per site.",
    );
  }
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
