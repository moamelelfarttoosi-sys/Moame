/* Login page — professional split-screen */
window.Pages = window.Pages || {};
Pages.login = {
  isPublic: true,
  render(root) {
    const user = UI.input({ autocomplete: 'username', placeholder: 'e.g. dcc' });
    const pass = UI.input({ type: 'password', autocomplete: 'current-password', placeholder: '••••••••' });
    const otpRow = el('div', { style: 'display:none' }, UI.field('MFA code (authenticator)', UI.input({ inputmode: 'numeric', maxlength: '6', id: 'otp', placeholder: '000000' }), true));
    const btn = el('button', { class: 'btn primary', style: 'width:100%; padding:10px; font-size:14px', onclick: doLogin }, 'Sign in');
    const err = el('div', { class: 'small', style: 'color:var(--danger); min-height:18px; margin-bottom:8px; font-weight:600' });

    async function doLogin() {
      err.textContent = '';
      btn.disabled = true;
      try {
        const body = { username: user.value.trim(), password: pass.value };
        const otp = root.querySelector('#otp');
        if (otp && otp.value) body.otp = otp.value.trim();
        const res = await API.post('/auth/login', body);
        if (res.data && res.data.mfa_required) {
          otpRow.style.display = '';
          err.style.color = 'var(--warn)';
          err.textContent = 'Enter the 6-digit code from your authenticator app.';
          return;
        }
        API.setToken(res.data.token);
        API.setProfile(res.data.profile);
        location.hash = '#/dashboard';
        App.render();
      } catch (e) {
        err.style.color = 'var(--danger)';
        err.textContent = e.message;
      } finally { btn.disabled = false; }
    }
    for (const inp of [user, pass]) inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

    root.append(el('div', { class: 'login-wrap' },
      // ---- brand panel ----
      el('div', { class: 'login-hero' },
        el('div', { class: 'brandrow' },
          el('div', { class: 'mark' }, 'ID'),
          el('div', {},
            el('h1', {}, 'IDMS'),
            el('div', { class: 'sub' }, 'Integrated Document Management'))),
        el('div', { class: 'pitch' },
          el('h2', {}, 'Controlled documents, engineered properly.'),
          el('p', {}, 'Registration, review, endorsement, approval, transmittals and records retention — one authoritative register for every controlled document.'),
          el('ul', {},
            el('li', {}, el('span', { class: 'tick' }, '✓'), el('span', {}, 'UEF dual numbering with series isolation and gap control')),
            el('li', {}, el('span', { class: 'tick' }, '✓'), el('span', {}, 'Configurable review → endorsement → approval workflows')),
            el('li', {}, el('span', { class: 'tick' }, '✓'), el('span', {}, 'Immutable audit trail and correction governance')),
            el('li', {}, el('span', { class: 'tick' }, '✓'), el('span', {}, 'SLA-tracked correspondence and SOP review cycles'))))),
      // ---- form panel ----
      el('div', { class: 'login-panel' },
        el('div', { class: 'login-card' },
          el('h3', {}, 'Sign in'),
          el('div', { class: 'sub' }, 'Use your IDMS document-control account.'),
          err,
          UI.field('Username', user, true),
          UI.field('Password', pass, true),
          otpRow,
          btn,
          el('div', { class: 'login-note' },
            el('b', {}, 'Demonstration accounts'), el('br'),
            'admin · dcc · reviewer · achuplin · approver · pm · contractor1 · viewer', el('br'),
            'Password: ', el('code', { class: 'mono' }, 'Password123!')))
  )));
  }
};