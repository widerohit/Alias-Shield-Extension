/* global AliasGenerator, DomainParser, ExportManager, StorageManager, chrome */
(function startPopup() {
  const els = {
    actionStatus: document.getElementById('actionStatus'),
    aliasText: document.getElementById('aliasText'),
    copyAlias: document.getElementById('copyAlias'),
    regenAlias: document.getElementById('regenAlias'),
    toggleSite: document.getElementById('toggleSite'),
    domainText: document.getElementById('domainText'),
    domainMeta: document.getElementById('domainMeta'),
    timeMeta: document.getElementById('timeMeta'),
    historyList: document.getElementById('historyList'),
    historySearch: document.getElementById('historySearch'),
    clearHistory: document.getElementById('clearHistory'),
    clearConfirm: document.getElementById('clearConfirm'),
    cancelClear: document.getElementById('cancelClear'),
    confirmClear: document.getElementById('confirmClear'),
    exportTxt: document.getElementById('exportTxt'),
    exportCsv: document.getElementById('exportCsv'),
    copyBlockQuery: document.getElementById('copyBlockQuery'),
    openSettings: document.getElementById('openSettings')
  };

  const state = {
    tab: null,
    settings: null,
    history: [],
    context: null,
    alias: ''
  };

  async function init() {
    state.settings = await StorageManager.getSettings();
    state.history = await StorageManager.getHistory();
    state.tab = await getActiveTab();
    state.context = await getContentContext();

    applyTheme(state.settings.theme);
    await refreshAlias();
    renderHistory();
    bindEvents();
  }

  function bindEvents() {
    els.copyAlias.addEventListener('click', copyAlias);
    els.regenAlias.addEventListener('click', regenerateAlias);
    els.toggleSite.addEventListener('click', toggleCurrentSite);
    els.historySearch.addEventListener('input', renderHistory);
    els.clearHistory.addEventListener('click', showClearConfirmation);
    els.cancelClear.addEventListener('click', hideClearConfirmation);
    els.confirmClear.addEventListener('click', clearHistory);
    els.exportTxt.addEventListener('click', () => exportSelected('txt'));
    els.exportCsv.addEventListener('click', () => exportSelected('csv'));
    els.copyBlockQuery.addEventListener('click', copyBlockQuery);
    els.openSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

    els.historyList.addEventListener('change', async (event) => {
      const checkbox = event.target.closest('input[type="checkbox"][data-id]');
      if (!checkbox) return;
      state.history = await StorageManager.updateAlias(checkbox.dataset.id, { selected: checkbox.checked });
      renderHistory();
    });

    els.historyList.addEventListener('click', async (event) => {
      const deleteButton = event.target.closest('button[data-delete-id]');
      if (!deleteButton) return;

      state.history = await StorageManager.deleteAlias(deleteButton.dataset.deleteId);
      els.actionStatus.textContent = 'Alias deleted.';
      renderHistory();
    });
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function getContentContext() {
    if (!state.tab?.id || !/^https?:/i.test(state.tab.url || '')) {
      return null;
    }

    try {
      return await chrome.tabs.sendMessage(state.tab.id, { type: 'ALIAS_GET_CONTEXT' });
    } catch (_error) {
      try {
        await ensureContentInjected(state.tab.id);
        return await chrome.tabs.sendMessage(state.tab.id, { type: 'ALIAS_GET_CONTEXT' });
      } catch (_injectionError) {
        const domain = DomainParser.parse(state.tab.url);
        return { alias: '', domain, url: state.tab.url };
      }
    }
  }

  async function ensureContentInjected(tabId) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['styles/content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'utils/domain.js',
        'utils/generator.js',
        'utils/storage.js',
        'content/detector.js',
        'content/widget.js',
        'content/main.js'
      ]
    });
  }

  async function refreshAlias(forceLocal = false) {
    const domain = state.context?.domain || DomainParser.parse(state.tab?.url || location.href);
    state.alias = state.context?.alias || '';

    if ((!state.alias || forceLocal) && state.settings.baseEmail) {
      state.alias = AliasGenerator.generateUnique(
        state.settings.baseEmail,
        domain.clean,
        state.history,
        { pattern: state.settings.pattern }
      );
    }

    els.aliasText.textContent = state.alias || 'Set your Gmail in settings';
    els.domainMeta.textContent = `Domain: ${domain.clean || '-'}`;
    els.timeMeta.textContent = `Timestamp: ${extractTimestamp(state.alias) || '-'}`;
    updateRegenerateState();
    updateSiteToggle(domain);
  }

  function extractTimestamp(alias) {
    return alias?.match(/\+([0-9]{12,}[0-9]*)@/)?.[1] || '';
  }

  async function copyAlias() {
    if (!state.alias) {
      els.actionStatus.textContent = 'Open settings and save your base Gmail first.';
      return;
    }
    await saveCurrentAliasToHistory();
    await navigator.clipboard.writeText(state.alias);
    els.copyAlias.textContent = 'Copied';
    els.actionStatus.dataset.state = 'ok';
    els.actionStatus.textContent = 'Alias copied and saved.';
    window.setTimeout(() => { els.copyAlias.textContent = 'Copy'; }, 900);
  }

  async function regenerateAlias() {
    if (!canRegenerate()) {
      els.actionStatus.textContent = 'Regenerate is disabled for this alias pattern.';
      els.actionStatus.dataset.state = 'warn';
      return;
    }

    let regeneratedInPage = false;
    if (state.tab?.id) {
      try {
        state.context = await chrome.tabs.sendMessage(state.tab.id, { type: 'ALIAS_REGENERATE' });
        regeneratedInPage = Boolean(state.context?.alias);
      } catch (_error) {
        state.context = null;
      }
    }
    await refreshAlias(!regeneratedInPage);
  }

  function updateRegenerateState() {
    const enabled = canRegenerate();
    els.regenAlias.disabled = !enabled;
    els.regenAlias.title = enabled
      ? 'Regenerate alias'
      : 'Regenerate needs a timestamp-based alias pattern';
    els.regenAlias.setAttribute('aria-disabled', String(!enabled));
  }

  function canRegenerate() {
    return /\{timestamp\}/.test(state.settings?.pattern || '');
  }

  async function toggleCurrentSite() {
    const domain = state.context?.domain || DomainParser.parse(state.tab?.url || location.href);
    const hostname = domain.hostname;
    if (!hostname || hostname === 'unknown') {
      els.actionStatus.textContent = 'This page cannot be added to the domain list.';
      els.actionStatus.dataset.state = 'warn';
      return;
    }

    const blacklist = Array.isArray(state.settings.blacklist) ? [...state.settings.blacklist] : [];
    const existingIndex = blacklist.findIndex((item) => isSameDomainRule(hostname, item));

    if (existingIndex >= 0) {
      blacklist.splice(existingIndex, 1);
      state.settings = await StorageManager.setSettings({ blacklist });
      els.actionStatus.textContent = 'AliasShield enabled on this site.';
      els.actionStatus.dataset.state = 'ok';
    } else {
      blacklist.push(hostname);
      state.settings = await StorageManager.setSettings({ blacklist });
      els.actionStatus.textContent = 'AliasShield disabled on this site.';
      els.actionStatus.dataset.state = 'warn';
    }

    updateSiteToggle(domain);
  }

  function updateSiteToggle(domain) {
    const hostname = domain?.hostname || '';
    const disabled = isDomainBlacklisted(hostname);
    els.toggleSite.textContent = disabled ? 'Enable on this site' : 'Disable on this site';
    els.toggleSite.classList.toggle('danger-button', !disabled);
  }

  function isDomainBlacklisted(hostname) {
    return (state.settings?.blacklist || []).some((rule) => isSameDomainRule(hostname, rule));
  }

  function isSameDomainRule(hostname, rule) {
    const cleanRule = String(rule || '').trim().toLowerCase();
    return cleanRule && (hostname === cleanRule || hostname.endsWith(`.${cleanRule}`));
  }

  function renderHistory() {
    const query = els.historySearch.value.trim().toLowerCase();
    const filtered = state.history.filter((item) => {
      const text = `${item.email} ${item.domain} ${item.url}`.toLowerCase();
      return !query || text.includes(query);
    }).slice(0, 50);

    if (!filtered.length) {
      els.historyList.innerHTML = '<p class="empty">No aliases yet.</p>';
      return;
    }

    els.historyList.innerHTML = filtered.map((item) => `
      <article class="history-item">
        <input type="checkbox" data-id="${escapeHtml(item.id)}" ${item.selected !== false ? 'checked' : ''} title="Select for export">
        <button class="history-copy" type="button" data-alias="${escapeHtml(item.email)}" title="Copy alias">${escapeHtml(item.email)}</button>
        <button class="history-delete" type="button" data-delete-id="${escapeHtml(item.id)}" title="Delete alias" aria-label="Delete alias">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6h18"></path>
            <path d="M8 6V4h8v2"></path>
            <path d="M19 6l-1 14H6L5 6"></path>
            <path d="M10 11v5M14 11v5"></path>
          </svg>
        </button>
        <span>${escapeHtml(item.domain)} - ${new Date(item.createdAt).toLocaleDateString()}</span>
      </article>
    `).join('');

    els.historyList.querySelectorAll('.history-copy').forEach((button) => {
      button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(button.dataset.alias);
        button.classList.add('copied');
        window.setTimeout(() => button.classList.remove('copied'), 700);
      });
    });
  }

  function selectedHistory() {
    return state.history.filter((item) => item.selected !== false);
  }

  async function saveCurrentAliasToHistory() {
    const domain = state.context?.domain || DomainParser.parse(state.tab?.url || location.href);
    await StorageManager.saveAlias({
      email: state.alias,
      domain: domain.clean,
      hostname: domain.hostname,
      url: state.context?.url || state.tab?.url || ''
    });
    state.history = await StorageManager.getHistory();
    renderHistory();
  }

  async function clearHistory() {
    if (!state.history.length) {
      els.actionStatus.textContent = 'Alias history is already empty.';
      return;
    }

    await StorageManager.clearHistory();
    state.history = [];
    hideClearConfirmation();
    els.actionStatus.textContent = 'Alias history cleared.';
    els.actionStatus.dataset.state = 'ok';
    renderHistory();
  }

  function showClearConfirmation() {
    if (!state.history.length) {
      els.actionStatus.textContent = 'Alias history is already empty.';
      els.actionStatus.dataset.state = 'warn';
      return;
    }

    els.clearConfirm.hidden = false;
  }

  function hideClearConfirmation() {
    els.clearConfirm.hidden = true;
  }

  function exportSelected(format) {
    const records = selectedHistory();
    const content = format === 'csv' ? ExportManager.toCSV(records) : ExportManager.toTXT(records);
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ExportManager.filename(format);
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyBlockQuery() {
    const query = ExportManager.toGmailBlockQuery(selectedHistory());
    if (!query) {
      els.actionStatus.textContent = 'Select at least one alias first.';
      return;
    }

    await navigator.clipboard.writeText(query);
    els.copyBlockQuery.textContent = 'Copied Query';
    els.actionStatus.textContent = 'Paste into Gmail search or a Gmail filter.';
    window.setTimeout(() => { els.copyBlockQuery.textContent = 'Copy Gmail Query'; }, 1000);
  }


  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  init().catch((error) => {
    els.actionStatus.textContent = error.message;
  });
})();
