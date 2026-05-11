/* global AliasGenerator, AliasWidget, DomainParser, SignupDetector, StorageManager, chrome */
(function startAliasShield() {
  if (globalThis.__AliasShieldStarted) return;
  globalThis.__AliasShieldStarted = true;

  const state = {
    settings: null,
    activeInput: null,
    alias: '',
    domain: DomainParser.parse(location.href),
    widget: null,
    dismissedInput: null,
    observer: null,
    scanTimer: 0
  };

  async function initialize() {
    state.settings = await StorageManager.getSettings();
    await StorageManager.pruneExpired();

    if (isBlacklisted()) return;

    state.widget = new AliasWidget({
      onCopy: copyAlias,
      onRegenerate: regenerate,
      onClose: dismissWidget
    });

    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('keydown', handleShortcut, true);
    observeMutations();
    scheduleScan();
  }

  function isBlacklisted() {
    const hostname = state.domain.hostname;
    return state.settings.blacklist.some((item) => {
      const rule = String(item || '').trim().toLowerCase();
      return rule && (hostname === rule || hostname.endsWith(`.${rule}`));
    });
  }

  async function ensureAlias(force = false) {
    if (!state.settings.baseEmail) return '';
    if (state.alias && !force) return state.alias;
    const history = await StorageManager.getHistory();
    state.alias = AliasGenerator.generateUnique(
      state.settings.baseEmail,
      state.domain.clean,
      history,
      { pattern: state.settings.pattern }
    );
    return state.alias;
  }

  async function handleFocusIn(event) {
    if (isBlacklisted()) return;
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (state.dismissedInput && state.dismissedInput !== input) {
      state.dismissedInput = null;
    }
    if (!SignupDetector.findEmailInputs(document).includes(input)) return;
    if (SignupDetector.isLoginContext(input)) {
      state.widget?.hide();
      return;
    }

    state.activeInput = input;
    const alias = await ensureAlias();
    if (!alias) return;

    if (state.settings.autoFill && !input.value) {
      await fillInput(input, alias);
    }

    if (state.settings.showWidget && state.dismissedInput !== input) {
      state.widget.show(input, alias, canRegenerate());
    }
  }

  async function scanForSignupInput() {
    if (isBlacklisted()) {
      state.widget?.hide();
      return;
    }

    const input = SignupDetector.findSignupEmailInput(document);
    if (!input) {
      state.widget?.hide();
      return;
    }

    state.activeInput = input;
    const alias = await ensureAlias();
    if (!alias) return;

    if (state.settings.autoFill && !input.value && document.visibilityState === 'visible') {
      await fillInput(input, alias);
    }

    if (state.settings.showWidget && document.activeElement === input && state.dismissedInput !== input) {
      state.widget.show(input, alias, canRegenerate());
    }
  }

  function scheduleScan() {
    window.clearTimeout(state.scanTimer);
    state.scanTimer = window.setTimeout(scanForSignupInput, 250);
  }

  function observeMutations() {
    state.observer = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.addedNodes.length)) {
        scheduleScan();
      }
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function fillInput(input, alias) {
    input.focus();
    setInputValue(input, alias);
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: alias
    }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    input.focus();

    await StorageManager.saveAlias({
      email: alias,
      domain: state.domain.clean,
      hostname: state.domain.hostname,
      url: location.href
    });
  }

  function setInputValue(input, value) {
    const ownDescriptor = Object.getOwnPropertyDescriptor(input, 'value');
    const prototype = Object.getPrototypeOf(input);
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (prototypeDescriptor?.set && ownDescriptor?.set !== prototypeDescriptor.set) {
      prototypeDescriptor.set.call(input, value);
      return;
    }

    input.value = value;
  }

  function dismissWidget() {
    state.dismissedInput = state.activeInput;
  }

  async function copyAlias() {
    const alias = await ensureAlias();
    if (!alias) return;
    await navigator.clipboard.writeText(alias);
  }

  async function regenerate() {
    state.alias = await ensureAlias(true);
    if (state.widget && state.activeInput) {
      state.widget.show(state.activeInput, state.alias, canRegenerate());
    }
  }

  function canRegenerate() {
    return /\{timestamp\}/.test(state.settings?.pattern || '');
  }

  async function handleShortcut(event) {
    if (!state.settings?.quickCopy) return;
    if (event.altKey && event.shiftKey && event.code === 'KeyC') {
      const alias = await ensureAlias();
      if (alias) {
        await navigator.clipboard.writeText(alias);
        event.preventDefault();
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      if (message.type === 'ALIAS_GET_CONTEXT') {
        const alias = await ensureAlias();
        sendResponse({ alias, domain: state.domain, url: location.href });
        return;
      }
      if (message.type === 'ALIAS_REGENERATE') {
        await regenerate();
        sendResponse({ alias: state.alias, domain: state.domain, url: location.href });
        return;
      }
      if (message.type === 'ALIAS_COPY_COMMAND') {
        await copyAlias();
        sendResponse({ copied: Boolean(state.alias), alias: state.alias });
        return;
      }
    })();
    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes.settings?.newValue) return;
    state.settings = { ...state.settings, ...changes.settings.newValue };
    if (isBlacklisted()) {
      state.widget?.hide();
      state.activeInput = null;
      state.alias = '';
      return;
    }
    scheduleScan();
  });

  initialize().catch((error) => {
    console.warn('AliasShield failed to initialize', error);
  });

})();
