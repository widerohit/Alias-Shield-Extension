/* global crypto, chrome, globalThis */
(function exposeStorageManager(global) {
  const DEFAULT_SETTINGS = {
    baseEmail: '',
    autoFill: true,
    showWidget: true,
    theme: 'system',
    pattern: '{base}+{domain}+{timestamp}@{host}',
    blacklist: ['accounts.google.com', 'mail.google.com'],
    maxHistory: 200,
    retentionDays: 0,
    quickCopy: true
  };

  const KEYS = {
    SETTINGS: 'settings',
    HISTORY: 'alias_history'
  };

  function getLocalStorage() {
    if (!global.chrome?.storage?.local) {
      throw new Error('Chrome local storage is not available in this context.');
    }
    return global.chrome.storage.local;
  }

  async function readLocal(key, fallback) {
    try {
      const result = await getLocalStorage().get(key);
      return result[key] ?? fallback;
    } catch (error) {
      console.warn('AliasShield storage read failed:', error);
      return fallback;
    }
  }

  async function writeLocal(values) {
    try {
      await getLocalStorage().set(values);
      return true;
    } catch (error) {
      console.warn('AliasShield storage write failed:', error);
      return false;
    }
  }

  const StorageManager = {
    KEYS,

    async getSettings() {
      const settings = await readLocal(KEYS.SETTINGS, {});
      return { ...DEFAULT_SETTINGS, ...(settings || {}) };
    },

    async setSettings(nextSettings) {
      const current = await StorageManager.getSettings();
      const settings = { ...current, ...nextSettings };
      await writeLocal({ [KEYS.SETTINGS]: settings });
      return settings;
    },

    async getBaseEmail() {
      const settings = await StorageManager.getSettings();
      return settings.baseEmail || '';
    },

    async setBaseEmail(email) {
      return StorageManager.setSettings({ baseEmail: String(email || '').trim() });
    },

    async getHistory() {
      const history = await readLocal(KEYS.HISTORY, []);
      return Array.isArray(history) ? history : [];
    },

    async saveAlias(aliasData) {
      const settings = await StorageManager.getSettings();
      const history = await StorageManager.getHistory();
      const existingIndex = history.findIndex((item) => item.email === aliasData.email);
      const record = {
        id: aliasData.id || `${Date.now()}-${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`,
        email: aliasData.email,
        domain: aliasData.domain,
        hostname: aliasData.hostname || '',
        url: aliasData.url || '',
        createdAt: aliasData.createdAt || new Date().toISOString(),
        selected: aliasData.selected ?? true
      };

      if (existingIndex >= 0) {
        history.splice(existingIndex, 1);
      }

      history.unshift(record);
      const cleaned = StorageManager.removeExpired(history, settings.retentionDays).slice(0, settings.maxHistory);
      await writeLocal({ [KEYS.HISTORY]: cleaned });
      return record;
    },

    removeExpired(history, retentionDays) {
      const days = Number(retentionDays || 0);
      if (!days) return history;

      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      return history.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
    },

    async pruneExpired() {
      const settings = await StorageManager.getSettings();
      const history = await StorageManager.getHistory();
      const pruned = StorageManager.removeExpired(history, settings.retentionDays).slice(0, settings.maxHistory);
      await writeLocal({ [KEYS.HISTORY]: pruned });
      return pruned.length;
    },

    async updateAlias(id, patch) {
      const history = await StorageManager.getHistory();
      const next = history.map((item) => item.id === id ? { ...item, ...patch } : item);
      await writeLocal({ [KEYS.HISTORY]: next });
      return next;
    },

    async deleteAlias(id) {
      const history = await StorageManager.getHistory();
      const next = history.filter((item) => item.id !== id);
      await writeLocal({ [KEYS.HISTORY]: next });
      return next;
    },

    async exportBackup() {
      return {
        app: 'AliasShield',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: await StorageManager.getSettings(),
        alias_history: await StorageManager.getHistory()
      };
    },

    async importBackup(backup) {
      if (!backup || backup.app !== 'AliasShield') {
        throw new Error('This is not a valid AliasShield backup.');
      }

      const settings = { ...DEFAULT_SETTINGS, ...(backup.settings || {}) };
      const history = Array.isArray(backup.alias_history) ? backup.alias_history : [];
      await writeLocal({
        [KEYS.SETTINGS]: settings,
        [KEYS.HISTORY]: history
      });
      return { settings, history };
    },

    async clearHistory() {
      await writeLocal({ [KEYS.HISTORY]: [] });
    }
  };

  global.StorageManager = StorageManager;

  if (typeof module !== 'undefined') {
    module.exports = StorageManager;
  }
})(globalThis);
