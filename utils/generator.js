/* global DomainParser, globalThis */
(function exposeAliasGenerator(global) {
  const GMAIL_HOSTS = new Set(['gmail.com', 'googlemail.com']);

  function splitEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const match = normalized.match(/^([a-z0-9.!#$%&'*+/=?^_`{|}~-]+)@(gmail\.com|googlemail\.com)$/i);
    if (!match) return null;

    const local = match[1].split('+')[0].replace(/\.+/g, '');
    const host = match[2].toLowerCase();
    return GMAIL_HOSTS.has(host) && local ? { local, host } : null;
  }

  const AliasGenerator = {
    validateBaseEmail(email) {
      return Boolean(splitEmail(email));
    },

    shortTimestamp(date = new Date()) {
      const y = String(date.getFullYear()).slice(2);
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return `${y}${m}${d}${hh}${mm}${ss}`;
    },

    dateTokens(date = new Date()) {
      const yyyy = String(date.getFullYear());
      const yy = yyyy.slice(2);
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const min = String(date.getMinutes()).padStart(2, '0');

      return {
        YYYY: yyyy,
        YY: yy,
        MM: mm,
        DD: dd,
        HH: hh,
        mm: min,
        YYYYMMDD: `${yyyy}${mm}${dd}`,
        YYMMDD: `${yy}${mm}${dd}`,
        YYYYMM: `${yyyy}${mm}`
      };
    },

    generate(baseEmail, domain, options = {}) {
      const parsedEmail = splitEmail(baseEmail);
      if (!parsedEmail) {
        throw new Error('Please enter a valid Gmail address.');
      }

      const now = new Date();
      const cleanDomain = (global.DomainParser || DomainParser).cleanLabel(domain);
      const timestamp = options.timestamp || this.shortTimestamp(now);
      const dateTokens = this.dateTokens(now);
      const pattern = options.pattern || '{base}+{domain}+{timestamp}@{host}';
      const safePattern = pattern.includes('{base}') && pattern.includes('{host}')
        ? pattern
        : '{base}+{domain}+{timestamp}@{host}';

      return safePattern
        .replaceAll('{base}', parsedEmail.local)
        .replaceAll('{domain}', cleanDomain)
        .replaceAll('{timestamp}', timestamp)
        .replaceAll('{YYYYMMDD}', dateTokens.YYYYMMDD)
        .replaceAll('{YYMMDD}', dateTokens.YYMMDD)
        .replaceAll('{YYYYMM}', dateTokens.YYYYMM)
        .replaceAll('{YYYY}', dateTokens.YYYY)
        .replaceAll('{YY}', dateTokens.YY)
        .replaceAll('{MM}', dateTokens.MM)
        .replaceAll('{DD}', dateTokens.DD)
        .replaceAll('{HH}', dateTokens.HH)
        .replaceAll('{mm}', dateTokens.mm)
        .replaceAll('{host}', parsedEmail.host)
        .replace(/\+{2,}/g, '+');
    },

    generateUnique(baseEmail, domain, existingAliases = [], options = {}) {
      const seen = new Set(existingAliases.map((item) => typeof item === 'string' ? item : item.email));
      let alias = this.generate(baseEmail, domain, options);
      let attempts = 0;

      while (seen.has(alias) && attempts < 25) {
        attempts += 1;
        alias = this.generate(baseEmail, domain, {
          ...options,
          timestamp: `${this.shortTimestamp(new Date())}${attempts}`
        });
      }

      return alias;
    }
  };

  global.AliasGenerator = AliasGenerator;

  if (typeof module !== 'undefined') {
    module.exports = AliasGenerator;
  }
})(globalThis);
