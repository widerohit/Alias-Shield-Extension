/* global AliasGenerator, StorageManager */
(function startSettingsPage() {
  const els = {
    baseEmail: document.getElementById('baseEmail'),
    saveSettings: document.getElementById('saveSettings'),
    settingsStatus: document.getElementById('settingsStatus'),
    saveIndicator: document.getElementById('saveIndicator'),
    autoFill: document.getElementById('autoFill'),
    showWidget: document.getElementById('showWidget'),
    quickCopy: document.getElementById('quickCopy'),
    patternPreset: document.getElementById('patternPreset'),
    patternInput: document.getElementById('patternInput'),
    patternPreview: document.getElementById('patternPreview'),
    blacklistInput: document.getElementById('blacklistInput'),
    retentionDays: document.getElementById('retentionDays'),
    exportBackup: document.getElementById('exportBackup'),
    importBackup: document.getElementById('importBackup'),
    backupFile: document.getElementById('backupFile'),
    themeToggle: document.getElementById('themeToggle')
  };

  let settings;
  let dirty = false;

  async function init() {
    settings = await StorageManager.getSettings();
    render();
    bindEvents();
  }

  function bindEvents() {
    els.saveSettings.addEventListener('click', saveSettings);
    els.themeToggle.addEventListener('click', toggleTheme);
    els.patternPreset.addEventListener('change', applyPatternPreset);
    els.patternInput.addEventListener('input', updatePreview);
    els.baseEmail.addEventListener('input', updatePreview);
    els.exportBackup.addEventListener('click', exportBackup);
    els.importBackup.addEventListener('click', () => els.backupFile.click());
    els.backupFile.addEventListener('change', importBackup);

    for (const control of [
      els.baseEmail,
      els.autoFill,
      els.showWidget,
      els.quickCopy,
      els.patternInput,
      els.blacklistInput,
      els.retentionDays
    ]) {
      control.addEventListener('input', markDirty);
      control.addEventListener('change', markDirty);
    }
  }

  function render() {
    els.baseEmail.value = settings.baseEmail || '';
    els.autoFill.checked = settings.autoFill;
    els.showWidget.checked = settings.showWidget;
    els.quickCopy.checked = settings.quickCopy;
    els.patternInput.value = settings.pattern;
    syncPatternPreset(settings.pattern);
    els.blacklistInput.value = settings.blacklist.join('\n');
    els.retentionDays.value = settings.retentionDays;
    document.documentElement.dataset.theme = settings.theme;
    setSavedIndicator('All settings saved.');
    updatePreview();
  }

  async function saveSettings() {
    const baseEmail = els.baseEmail.value.trim();
    if (baseEmail && !AliasGenerator.validateBaseEmail(baseEmail)) {
      els.settingsStatus.textContent = 'Use a valid Gmail address.';
      return;
    }

    const blacklist = els.blacklistInput.value
      .split(/\n|,/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);

    settings = await StorageManager.setSettings({
      baseEmail,
      autoFill: els.autoFill.checked,
      showWidget: els.showWidget.checked,
      quickCopy: els.quickCopy.checked,
      pattern: els.patternInput.value.trim() || '{base}+{domain}+{timestamp}@{host}',
      blacklist,
      retentionDays: Math.max(0, Number(els.retentionDays.value || 0))
    });

    await StorageManager.pruneExpired();
    els.settingsStatus.textContent = 'Settings saved locally.';
    dirty = false;
    setSavedIndicator('All settings saved.');
  }

  async function toggleTheme() {
    const next = settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'system' : 'dark';
    settings = await StorageManager.setSettings({ theme: next });
    document.documentElement.dataset.theme = next;
    setSavedIndicator('Theme saved.');
  }

  function applyPatternPreset() {
    if (els.patternPreset.value === 'custom') return;
    els.patternInput.value = els.patternPreset.value;
    markDirty();
    updatePreview();
  }

  function syncPatternPreset(pattern) {
    const option = Array.from(els.patternPreset.options)
      .find((item) => item.value === pattern);
    els.patternPreset.value = option ? pattern : 'custom';
  }

  function updatePreview() {
    const baseEmail = els.baseEmail.value.trim() || 'name@gmail.com';
    const pattern = els.patternInput.value.trim() || '{base}+{domain}+{YYYYMMDD}@{host}';

    try {
      els.patternPreview.textContent = AliasGenerator.generate(baseEmail, 'exampledomain', { pattern });
    } catch (_error) {
      els.patternPreview.textContent = 'Enter a valid Gmail address to preview.';
    }
  }

  function markDirty() {
    dirty = true;
    setSavedIndicator('Unsaved changes.');
  }

  function setSavedIndicator(text) {
    els.saveIndicator.textContent = text;
    els.saveIndicator.dataset.state = dirty ? 'dirty' : 'saved';
  }

  async function exportBackup() {
    const backup = await StorageManager.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aliasshield-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    els.settingsStatus.textContent = 'Backup exported.';
  }

  async function importBackup(event) {
    const [file] = event.target.files || [];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const imported = await StorageManager.importBackup(backup);
      settings = imported.settings;
      dirty = false;
      render();
      els.settingsStatus.textContent = `Imported ${imported.history.length} aliases.`;
    } catch (error) {
      els.settingsStatus.textContent = error.message || 'Could not import backup.';
    } finally {
      els.backupFile.value = '';
    }
  }

  init().catch((error) => {
    els.settingsStatus.textContent = error.message;
  });
})();
