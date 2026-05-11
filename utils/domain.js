/* global globalThis */
(function exposeDomainParser(global) {
  const SECOND_LEVEL_TLDS = new Set([
    'ac', 'co', 'com', 'edu', 'gov', 'net', 'org', 'sch'
  ]);

  function normalizeHost(hostname) {
    return String(hostname || '')
      .trim()
      .toLowerCase()
      .replace(/\.$/, '')
      .replace(/^m\./, '')
      .replace(/^www\d*\./, '');
  }

  const DomainParser = {
    parse(urlLike) {
      try {
        const url = new URL(urlLike || global.location?.href || '');
        const hostname = normalizeHost(url.hostname);

        if (!hostname || hostname === 'localhost') {
          return { hostname: hostname || 'unknown', label: 'local', clean: 'local' };
        }

        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
          return { hostname, label: hostname.replace(/\./g, '-'), clean: 'ip' };
        }

        const labels = hostname.split('.').filter(Boolean);
        let registrableIndex = labels.length >= 2 ? labels.length - 2 : 0;
        const last = labels[labels.length - 1];
        const beforeLast = labels[labels.length - 2];

        if (labels.length >= 3 && last.length === 2 && SECOND_LEVEL_TLDS.has(beforeLast)) {
          registrableIndex = labels.length - 3;
        }

        const label = labels[registrableIndex] || labels[0] || 'unknown';
        return {
          hostname,
          label,
          clean: this.cleanLabel(label)
        };
      } catch (error) {
        return { hostname: 'unknown', label: 'unknown', clean: 'unknown' };
      }
    },

    getCleanDomain(urlLike) {
      return this.parse(urlLike).clean;
    },

    cleanLabel(value) {
      const cleaned = String(value || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();

      return cleaned.slice(0, 32) || 'site';
    }
  };

  global.DomainParser = DomainParser;

  if (typeof module !== 'undefined') {
    module.exports = DomainParser;
  }
})(globalThis);
