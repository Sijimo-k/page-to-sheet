// Open the side panel ourselves when the toolbar icon is clicked.
// With openPanelOnActionClick Chrome opens the panel but does not grant activeTab, so the panel could not
// see the page's URL. Handling the click here grants activeTab for that tab (no "tabs" permission needed).
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.action.onClicked.addListener((tab) => {
  // Must be called synchronously inside the click handler (user gesture).
  if (tab.windowId !== undefined) void chrome.sidePanel.open({ windowId: tab.windowId });
});
