/* global globalThis */
(function exposeSignupDetector(global) {
  const SIGNUP_TERMS = [
    'sign up', 'signup', 'register', 'registration', 'create account', 'create your account',
    'join now', 'get started', 'start free', 'trial', 'new account', 'continue with email'
  ];
  const LOGIN_TERMS = [
    'login', 'log in', 'sign in', 'signin', 'password reset', 'forgot password',
    'reset password', 'recover account', 'two-factor', 'verification code'
  ];

  function textOf(node) {
    if (!node) return '';
    const labels = [];
    const id = node.getAttribute?.('id');
    if (id) {
      labels.push(...Array.from(document.querySelectorAll(`label[for="${CSS.escape(id)}"]`)).map((label) => label.textContent));
    }
    labels.push(
      node.getAttribute?.('aria-label'),
      node.getAttribute?.('placeholder'),
      node.getAttribute?.('name'),
      node.getAttribute?.('id'),
      node.closest?.('form, section, main, [role="dialog"], [class], [id]')?.textContent
    );
    return labels.filter(Boolean).join(' ').replace(/\s+/g, ' ').toLowerCase().slice(0, 5000);
  }

  function countTerms(text, terms) {
    return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  }

  function hasRegisterAction(container) {
    const controls = Array.from(container.querySelectorAll?.('button, input[type="submit"], input[type="button"], a[role="button"], a[href]') || []);
    return controls.some((control) => countTerms(textOf(control), SIGNUP_TERMS) > 0);
  }

  const SignupDetector = {
    findEmailInputs(root = document) {
      return Array.from(root.querySelectorAll?.('input:not([disabled]):not([readonly])') || [])
        .filter((input) => {
          const type = (input.getAttribute('type') || 'text').toLowerCase();
          const inputMode = (input.getAttribute('inputmode') || '').toLowerCase();
          const hints = textOf(input);
          return type === 'email' || inputMode === 'email' || /\b(e-?mail|email address)\b/.test(hints);
        });
    },

    scoreInput(input) {
      const container = input.closest('form, [role="form"], section, main, [role="dialog"], div') || document.body;
      const pageText = [
        document.title,
        location.pathname,
        textOf(input),
        textOf(container)
      ].join(' ').toLowerCase();

      const signupScore = countTerms(pageText, SIGNUP_TERMS);
      const loginScore = countTerms(pageText, LOGIN_TERMS);
      const hasPassword = Boolean(container.querySelector('input[type="password"]'));
      const hasConfirmPassword = Array.from(container.querySelectorAll('input[type="password"]'))
        .some((field) => /confirm|repeat|new/.test(textOf(field)));
      const hasNameField = Boolean(container.querySelector('input[name*="name" i], input[autocomplete="name"], input[autocomplete="given-name"]'));
      const registerAction = hasRegisterAction(container);
      const loginPath = /\/(log[\-_]?in|sign[\-_]?in|session|auth)\b/i.test(location.pathname);
      const signupPath = /\/(sign[\-_]?up|register|create[\-_]?account|join|get[\-_]?started)\b/i.test(location.pathname);

      let score = 0;
      score += signupScore * 3;
      score += registerAction ? 4 : 0;
      score += hasConfirmPassword ? 3 : 0;
      score += hasNameField ? 1 : 0;
      score += signupPath ? 3 : 0;
      score -= loginScore * 3;
      score -= loginPath ? 5 : 0;
      score -= hasPassword && !hasConfirmPassword && !registerAction && signupScore === 0 ? 3 : 0;

      return { score, container, isSignup: score >= 3 };
    },

    findSignupEmailInput(root = document) {
      const candidates = this.findEmailInputs(root)
        .map((input) => ({ input, result: this.scoreInput(input) }))
        .filter((item) => item.result.isSignup)
        .sort((a, b) => b.result.score - a.result.score);

      return candidates[0]?.input || null;
    },

    isLoginContext(input) {
      return this.scoreInput(input).score < 3;
    }
  };

  global.SignupDetector = SignupDetector;
})(globalThis);
