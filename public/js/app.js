/* App shell: router, layout, navigation, global search, notifications */
window.App = (() => {
  const { el } = UI;

  const NAV = [
    ['Main', [
      ['#dashboard', 'Dashboard', '▦', null],
      ['#tasks', 'My Tasks', '✓', null],
      ['#approvals', 'Approvals', '✔', null],
      ['#notifications', 'Notifications', '🔔', null]
    ]],
    ['Registers', [
      ['#documents', 'Document Register (DCR)', '📄', null],
      ['#documents?direction=incoming', 'Incoming (LOIR)', '⬇', null],
      ['#registers?type=TDR', 'Technical Register (TDR)', '🔧', null],
      ['#registers?type=MDR', 'Management Register (MDR)', '📋', null],
      ['#registers?type=VDR', 'Vendor Register (VDR)', '🏭', null],
      ['#registers?type=SOP', 'SOP & Corporate Register', '📚', null],
      ['#allocations', 'Number Allocation', '🔢', 'number.allocate'],
      ['#transmittals', 'Transmittals', '📤', null],
      ['#correspondence', 'Correspondence', '✉', null],
      ['#memos', 'Office Memo', '📝', null],
      ['#resolutions', 'Resolutions', '⚖', null]
    ]],
    ['Tools', [
      ['#search', 'Advanced Search', '🔍', null],
      ['#reports', 'Reports', '📊', null],
      ['#projectregister', 'Project Register', '🏗', null],
      ['#archive', 'Archive', '🗄', null],
      ['#corrections', 'Correction Log', '✏', 'correction.record'],
      ['#codes', 'Code Registry', '🗂', 'codes.manage'],
      ['#ddm', 'Distribution Matrix (DDM)', '🔀', 'ddm.manage'],
      ['#audit', 'Audit Trail', '🛡', 'audit.view'],
      ['#admin', 'Administration', '⚙', 'admin.manage']
    ]]
  ];

  const ROUTES = {
    dashboard: Pages.dashboard,
    documents: Pages.documents,
    docdetail: Pages.docdetail,
    tasks: Pages.tasks,
    transmittals: Pages.transmittals,
    transmittaldetail: Pages.transmittaldetail,
    correspondence: Pages.correspondence,
    memos: Pages.memos,
    resolutions: Pages.resolutions,
    search: Pages.search,
    reports: Pages.reports,
    notifications: Pages.notifications,
    audit: Pages.audit,
    admin: Pages.admin,
    registers: Pages.uefRegisters,
    allocations: Pages.uefAllocations,
    codes: Pages.uefCodes,
    ddm: Pages.uefDdm,
    corrections: Pages.uefCorrections,
    projectregister: Pages.projectRegister,
    approvals: Pages.approvalCenter,
    archive: Pages.archiveCenter,
    help: Pages.helpCenter
  };

  const ROUTE_PERMS = {
    admin: 'admin.manage',
    codes: 'codes.manage',
    ddm: 'ddm.manage',
    corrections: 'correction.record',
    audit: 'audit.view'
  };

  // Route metadata for breadcrumbs & default module titles.
  const META = {
    dashboard: { title: 'Dashboard', section: null },
    tasks: { title: 'My Tasks', section: null },
    approvals: { title: 'Approval Center', section: null },
    notifications: { title: 'Notifications', section: null },
    documents: { title: 'Document Register', section: 'Registers' },
    docdetail: { title: 'Document', section: 'Registers', parent: ['Document Register', '#/documents'] },
    registers: { title: 'Register', section: 'Registers' },
    allocations: { title: 'Number Allocation', section: 'Registers' },
    transmittals: { title: 'Transmittals', section: 'Registers' },
    transmittaldetail: { title: 'Transmittal', section: 'Registers', parent: ['Transmittals', '#/transmittals'] },
    correspondence: { title: 'Correspondence', section: 'Registers' },
    memos: { title: 'Office Memo', section: 'Registers' },
    resolutions: { title: 'Resolutions', section: 'Registers' },
    search: { title: 'Advanced Search', section: 'Tools' },
    reports: { title: 'Reports', section: 'Tools' },
    projectregister: { title: 'Project Register', section: 'Tools' },
    archive: { title: 'Archive', section: 'Tools' },
    corrections: { title: 'Correction Log', section: 'Tools' },
    codes: { title: 'Code Registry', section: 'Tools' },
    ddm: { title: 'Distribution Matrix', section: 'Tools' },
    audit: { title: 'Audit Trail', section: 'Tools' },
    admin: { title: 'Administration', section: 'Tools' },
    help: { title: 'Help & Guide', section: null }
  };

  const REGISTER_TITLES = { TDR: 'Technical Register (TDR)', MDR: 'Management Register (MDR)', VDR: 'Vendor Register (VDR)', SOP: 'SOP & Corporate Register', DCR: 'Document Register (DCR)' };

  function parseHash() {
    const h = location.hash.replace(/^#+\/?/, '') || 'dashboard';
    const [pathPart, queryPart] = h.split('?');
    const segs = pathPart.split('/').filter(Boolean);
    const query = {};
    for (const kv of (queryPart || '').split('&').filter(Boolean)) {
      const [k, v] = kv.split('='); query[k] = decodeURIComponent(v || '');
    }
    let route = segs[0] || 'dashboard';
    if (route === 'documents' && segs[1]) route = 'docdetail';
    if (route === 'transmittals' && segs[1]) route = 'transmittaldetail';
    return { route: ROUTES[route] ? route : 'dashboard', params: segs.slice(1), query };
  }

  function navLink(hash, label, icon, perm) {
    if (perm && !API.can(perm)) return null;
    return el('a', { href: hash.startsWith('#') ? hash : '#' + hash, 'data-label': label, title: label },
      el('span', { class: 'ico' }, icon), el('span', { class: 'lbl' }, label));
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function sidebarCollapsed() { return localStorage.getItem('idms.sidebar') === 'collapsed'; }
  function toggleSidebar() {
    const shell = document.querySelector('.shell');
    if (!shell) return;
    const collapsed = shell.classList.toggle('collapsed');
    localStorage.setItem('idms.sidebar', collapsed ? 'collapsed' : 'expanded');
  }
  function toggleMobileNav(force) {
    const shell = document.querySelector('.shell');
    if (shell) shell.classList.toggle('nav-open', force);
  }

  function layout() {
    const shell = el('div', { class: 'shell' + (sidebarCollapsed() ? ' collapsed' : '') });
    const sidebar = el('div', { class: 'sidebar' },
      el('div', { class: 'brand' },
        el('div', { class: 'mark' }, 'ID'),
        el('div', { class: 'bx' },
          el('div', { class: 't' }, 'IDMS'),
          el('div', { class: 's' }, 'Document Control')),
        el('button', { class: 'collapse-btn', title: 'Collapse / expand sidebar', 'aria-label': 'Toggle sidebar', onclick: toggleSidebar }, '⟨')),
      (() => {
        const n = el('div', { class: 'nav' });
        for (const [sec, items] of NAV) {
          const links = items.map(([h, l, i, p]) => navLink(h, l, i, p)).filter(Boolean);
          if (links.length) n.append(el('div', { class: 'sec' }, sec), ...links);
        }
        return n;
      })(),
      el('div', { class: 'side-foot' }, el('b', {}, 'UEF Document Control'), el('div', {}, 'v1.0 · Enterprise')));

    // global quick search
    const search = el('input', {
      type: 'search', placeholder: 'Search documents by number or title…', 'aria-label': 'Global search',
      onkeydown: e => { if (e.key === 'Enter' && e.target.value.trim()) { location.hash = '#/documents?search=' + encodeURIComponent(e.target.value.trim()); } }
    });

    const main = el('div', { class: 'main' },
      el('div', { class: 'topbar' },
        el('button', { class: 'iconbtn hamburger', title: 'Menu', 'aria-label': 'Open navigation', onclick: () => toggleMobileNav() }, '☰'),
        el('div', { class: 'titlewrap' },
          el('div', { class: 'crumbs', id: '_crumbs' }),
          el('div', { class: 'title' }, '')),
        el('div', { class: 'topsearch' },
          el('span', { class: 'si' }, '🔍'), search, el('span', { class: 'kbd' }, '/')),
        el('div', { class: 'spacer' }),
        el('button', { class: 'iconbtn', id: '_bell', title: 'Notifications', 'aria-label': 'Notifications', onclick: toggleNotifPanel }, '🔔', el('span', { class: 'cnt', id: '_bellCount' }, '')),
        el('div', { class: 'who', onclick: profileModal, title: 'Profile', tabindex: '0' },
          el('div', { class: 'avatar' }, initials(API.getProfile()?.full_name)),
          el('div', { class: 'meta' },
            el('b', {}, API.getProfile()?.full_name || ''),
            el('span', {}, `${API.getProfile()?.role_name || ''}`))),
        el('button', { class: 'btn sm', onclick: logout }, 'Sign out')),
      el('div', { class: 'content', id: '_content' }));

    const scrim = el('div', { class: 'nav-scrim', onclick: () => toggleMobileNav(false) });
    shell.append(sidebar, scrim, main);
    // close mobile nav on link click
    sidebar.addEventListener('click', e => { if (e.target.closest('.nav a')) toggleMobileNav(false); });
    return shell;
  }

  function setCrumbs(route, query, params) {
    const box = document.getElementById('_crumbs');
    if (!box) return;
    box.innerHTML = '';
    const m = META[route] || { title: route };
    if (route === 'dashboard') { box.append(UI.breadcrumb([['Dashboard']])); const t0 = document.querySelector('.topbar .title'); if (t0) t0.textContent = 'Operations Dashboard'; return; }
    const items = [['Dashboard', '#/dashboard']];
    if (m.section) items.push([m.section]);
    if (m.parent) items.push(m.parent);
    let title = m.title;
    if (route === 'registers' && query.type) title = REGISTER_TITLES[query.type] || (query.type + ' Register');
    if (route === 'documents' && query.direction === 'incoming') title = 'Incoming (LOIR)';
    if (route === 'docdetail' && params[0]) title = 'DOC #' + params[0];
    if (route === 'transmittaldetail' && params[0]) title = 'TRN #' + params[0];
    items.push([title]);
    box.append(UI.breadcrumb(items));
    // default module title (pages may override during render)
    const t = document.querySelector('.topbar .title');
    if (t) t.textContent = route === 'dashboard' ? 'Operations Dashboard' : title;
  }

  /* ---------------- notifications panel ---------------- */
  let notifOpen = null;
  function closeNotifPanel() { if (notifOpen) { notifOpen.remove(); notifOpen = null; document.removeEventListener('click', notifOutside, true); } }
  function notifOutside(e) { if (notifOpen && !notifOpen.contains(e.target) && !e.target.closest('#_bell')) closeNotifPanel(); }
  async function toggleNotifPanel(e) {
    if (e) e.stopPropagation();
    if (notifOpen) return closeNotifPanel();
    const pop = el('div', { class: 'notif-pop' },
      el('div', { class: 'nh' }, el('b', {}, 'Notifications'),
        el('button', { class: 'btn sm ghost', onclick: markAllRead }, 'Mark all read')),
      el('div', { class: 'notif-list', id: '_notifList' }, el('div', { style: 'padding:24px', class: 'muted small center' }, 'Loading…')));
    document.body.append(pop); notifOpen = pop;
    setTimeout(() => document.addEventListener('click', notifOutside, true), 0);
    try {
      const res = await API.get('/notifications?pageSize=8');
      const list = document.getElementById('_notifList');
      list.innerHTML = '';
      if (!res.data.length) { list.append(UI.emptyState({ icon: '🔔', title: 'All clear', message: 'You have no notifications right now.' })); return; }
      const ICON = { review: '📝', approval: '✔', endorsement: '🖊', transmittal: '📤', overdue: '⏰', resolution: '⚖', correspondence: '✉' };
      for (const n of res.data) {
        const ico = ICON[Object.keys(ICON).find(k => (n.event_code || '').toLowerCase().includes(k))] || 'ℹ';
        const item = el('div', { class: 'notif-item' + (n.read_at ? '' : ' unread') },
          el('div', { class: 'ni-ico' }, ico),
          el('div', { class: 'ni-b' },
            el('div', { class: 'ni-t' }, n.title || n.event_code || 'Notification'),
            n.body ? el('div', { class: 'ni-m' }, n.body) : null,
            el('div', { class: 'ni-time' }, UI.fmtDT(n.created_at))));
        item.addEventListener('click', async () => {
          if (!n.read_at) { try { await API.post(`/notifications/${n.id}/read`); } catch {} }
          closeNotifPanel(); location.hash = '#/notifications'; refreshBell();
        });
        list.append(item);
      }
      const foot = el('div', { style: 'padding:9px 16px;border-top:1px solid var(--line);text-align:center' },
        el('a', { href: '#/notifications', style: 'font-size:12.5px;font-weight:600;color:var(--brand-2);text-decoration:none', onclick: closeNotifPanel }, 'View all notifications →'));
      pop.append(foot);
    } catch (e) {
      const list = document.getElementById('_notifList');
      if (list) { list.innerHTML = ''; list.append(el('div', { class: 'muted small', style: 'padding:20px' }, 'Could not load notifications.')); }
    }
  }
  async function markAllRead() {
    try { await API.post('/notifications/read-all'); UI.toast('All notifications marked read', 'ok'); closeNotifPanel(); refreshBell(); }
    catch (e) { UI.toast(e.message, 'err'); }
  }

  async function refreshBell() {
    try {
      const res = await API.get('/notifications?unread=1&pageSize=1');
      const b = document.getElementById('_bellCount');
      if (b) b.textContent = res.meta.unread ? String(res.meta.unread) : '';
    } catch {}
  }

  function logout() {
    API.post('/auth/logout').catch(() => {});
    API.setToken(null); API.setProfile(null);
    location.hash = '#/login';
    render();
  }

  function profileModal() {
    UI.modal('Profile & security', el('div', {},
      el('dl', { class: 'kv' },
        el('dt', {}, 'User'), el('dd', {}, API.getProfile().full_name),
        el('dt', {}, 'Username'), el('dd', {}, API.getProfile().username),
        el('dt', {}, 'Role'), el('dd', {}, `${API.getProfile().role_name} (${API.getProfile().role_code})`),
        el('dt', {}, 'MFA'), el('dd', {}, API.getProfile().mfa_enabled ? 'Enabled' : 'Not enabled'))), {});
  }

  async function render() {
    const root = document.getElementById('app');
    const authed = !!API.getToken();
    const { route, params, query } = parseHash();

    if (!authed || route === 'login') {
      root.innerHTML = '';
      Pages.login.render(root);
      return;
    }
    if (!API.getProfile()) {
      try { API.setProfile((await API.get('/auth/me')).data); }
      catch { API.setToken(null); return render(); }
    }

    const requiredPerm = ROUTE_PERMS[route];
    if (requiredPerm && !API.can(requiredPerm)) {
      location.hash = '#/dashboard';
      UI.toast && UI.toast('Access denied — insufficient permissions', 'err');
      return;
    }

    closeNotifPanel();
    root.innerHTML = '';
    root.append(layout());
    setCrumbs(route, query, params);
    const content = document.getElementById('_content');
    const page = ROUTES[route];
    try {
      await page.render(content, params, query);
    }
    catch (e) {
      content.innerHTML = '';
      content.append(el('div', { class: 'card' }, el('div', { class: 'bd' },
        UI.emptyState({
          icon: '⚠', title: 'This page could not be loaded',
          message: e.message || 'An unexpected error occurred. Please retry or return to the dashboard.',
          actions: [
            el('button', { class: 'btn', onclick: () => render() }, 'Retry'),
            el('a', { class: 'btn primary', href: '#/dashboard' }, 'Go to dashboard')
          ]
        }))));
    }
    markActive();
    refreshBell();
  }

  function markActive() {
    const norm = s => String(s || '').replace(/^#\/?/, '') || 'dashboard';
    const cur = norm(location.hash);
    const curPath = cur.split('?')[0];
    document.querySelectorAll('.nav a').forEach(a => {
      const href = norm(a.getAttribute('href'));
      // exact match (incl. query); or plain link matching a plain current route
      const match = href === cur || (!href.includes('?') && !cur.includes('?') && href === curPath);
      a.classList.toggle('active', match);
    });
  }

  window.addEventListener('hashchange', () => {
    if (API.getToken()) render();
  });

  // keyboard shortcuts: "/" focuses global search, Esc closes overlays
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
      const s = document.querySelector('.topsearch input');
      if (s) { e.preventDefault(); s.focus(); }
    }
    if (e.key === 'Escape') {
      closeNotifPanel();
      const mask = document.querySelector('.modal-mask'); if (mask) mask.remove();
    }
  });

  return { render, refreshBell };
})();

document.addEventListener('DOMContentLoaded', () => App.render());

window.addEventListener('DOMContentLoaded', () => {
  API.onUnauthorized(() => {
    API.setToken(null); API.setProfile(null);
    UI.toast && UI.toast('Session expired — please sign in again', 'err');
    setTimeout(() => location.reload(), 600);
  });
});
