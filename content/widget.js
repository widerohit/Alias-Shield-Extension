/* global chrome, globalThis */
(function exposeAliasWidget(global) {
  class AliasWidget {
    constructor({ onCopy, onRegenerate, onClose }) {
      this.onCopy = onCopy;
      this.onRegenerate = onRegenerate;
      this.onClose = onClose;
      this.alias = '';
      this.input = null;
      this.node = this.createNode();
      document.documentElement.appendChild(this.node);
      window.addEventListener('scroll', () => this.reposition(), true);
      window.addEventListener('resize', () => this.reposition());
    }

    createNode() {
      const node = document.createElement('aside');
      node.className = 'as-widget';
      node.innerHTML = `
        <div class="as-widget__head">
          <div class="as-widget__label">AliasShield</div>
          <button class="as-widget__close" type="button" data-action="close" title="Close suggestion" aria-label="Close suggestion">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <button class="as-widget__alias" type="button" data-action="copy" title="Copy alias"></button>
        <div class="as-widget__actions">
          <button type="button" data-action="copy">Copy</button>
          <button type="button" data-action="regen">New</button>
        </div>
      `;
      node.addEventListener('mousedown', (event) => event.preventDefault());
      node.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const action = button.dataset.action || 'fill';
        if (action === 'close') {
          this.onClose?.();
          this.hide();
          return;
        }
        if (action === 'copy') await this.onCopy?.();
        if (action === 'regen') await this.onRegenerate?.();
      });
      return node;
    }

    show(input, alias, canRegenerate = true) {
      this.input = input;
      this.alias = alias;
      this.node.querySelector('.as-widget__alias').textContent = alias;
      const regenButton = this.node.querySelector('[data-action="regen"]');
      regenButton.disabled = !canRegenerate;
      regenButton.title = canRegenerate
        ? 'Generate a new alias'
        : 'New aliases need a timestamp-based pattern';
      this.node.classList.add('as-widget--visible');
      this.reposition();
    }

    hide() {
      this.node.classList.remove('as-widget--visible');
    }

    reposition() {
      if (!this.input || !this.node.classList.contains('as-widget--visible')) return;
      const rect = this.input.getBoundingClientRect();
      const top = Math.max(8, rect.bottom + 8);
      const left = Math.min(
        window.innerWidth - this.node.offsetWidth - 8,
        Math.max(8, rect.left)
      );
      this.node.style.top = `${top}px`;
      this.node.style.left = `${left}px`;
    }
  }

  global.AliasWidget = AliasWidget;
})(globalThis);
