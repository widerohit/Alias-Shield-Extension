/* global globalThis */
(function exposeExportManager(global) {
  function escapeCsv(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  const ExportManager = {
    toCSV(records) {
      const header = ['alias', 'domain', 'created_at', 'url', 'gmail_filter_query'];
      const rows = records.map((item) => [
        item.email,
        item.domain,
        item.createdAt,
        item.url,
        `to:(${item.email})`
      ].map(escapeCsv).join(','));

      return [header.join(','), ...rows].join('\n');
    },

    toTXT(records) {
      return records.map((item) => item.email).join('\n');
    },

    toGmailBlockQuery(records) {
      const aliases = records
        .map((item) => item.email)
        .filter(Boolean)
        .map((email) => email.replace(/[(){}[\]"']/g, ''))
        .filter((email, index, all) => all.indexOf(email) === index);

      if (!aliases.length) return '';
      return `to:(${aliases.join(' OR ')})`;
    },

    filename(format) {
      const stamp = new Date().toISOString().slice(0, 10);
      return `aliasshield-aliases-${stamp}.${format}`;
    }
  };

  global.ExportManager = ExportManager;

  if (typeof module !== 'undefined') {
    module.exports = ExportManager;
  }
})(globalThis);
