/* global chrome */
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        baseEmail: '',
        autoFill: true,
        showWidget: true,
        theme: 'system',
        pattern: '{base}+{domain}+{timestamp}@{host}',
        blacklist: ['accounts.google.com', 'mail.google.com'],
        maxHistory: 200,
        retentionDays: 0,
        quickCopy: true
      },
      alias_history: []
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'GET_ACTIVE_TAB') return false;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    sendResponse(tabs[0] || null);
  });

  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'copy-current-alias') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/i.test(tab.url || '')) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'ALIAS_COPY_COMMAND' });
  } catch (_error) {
    // Content scripts are not available on Chrome internal pages or pages opened before install.
  }
});
