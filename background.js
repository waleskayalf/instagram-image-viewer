chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "OPEN_IMAGE" || !sender.tab) return;

  let url;
  try {
    url = new URL(message.url);
  } catch {
    return;
  }
  if (url.protocol !== "https:") return;

  chrome.tabs.create({
    url: url.href,
    index: sender.tab.index + 1,
    openerTabId: sender.tab.id,
  });
});
