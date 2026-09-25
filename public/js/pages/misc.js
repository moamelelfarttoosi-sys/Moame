/* Reports, Notifications, Audit pages */
window.Pages = window.Pages || {};

Pages.reports = {
  title: 'Reports & Registers',
  async render(root) {
    const list = (await API.get('/reports')).data;
    const box = el('div');
    document.querySelector('.topbar .title').textContent = 'Reports';

    root.append(el('div', { class: 'grid g3' }, list.map(r =>
      el('div', { class: 'card' }, el('div', { class: 'bd' },
        el('b', {}, r.title),
        el('div', { class: 'btnrow mt' },
          el('button', { class: 'btn sm', onclick: () => preview(r.key, r.title) }, 'Preview'),
          API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exp(r.key, 'csv') }, 'CSV') : null,
          API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exp(r.key, 'excel') }, 'Excel') : null,
          API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exp(r.key, 'pdf') }, 'PDF') : null))))));

    async function preview(key, title) {
      const res = await API.get('/reports/' + key);
      UI.modal(title + ' (' + res.meta.total + ' rows)', el('div', {},
        UI.table({
          columns: Object.keys(res.data[0]?.cells || {}).slice(0, 10).map(k => ({ key: k, label: k.replace(/_/g, ' ') })),
          rows: res.data.slice(0, 200).map(x => x.cells),
          emptyText: 'Report is empty'
        })), { lg: true });
    }
    function exp(key, format) {
      API.get(`/reports/${key}?format=${format}`).then(res => {
        UI.downloadFile(res.data.download);
        UI.toast('Export ready', 'ok');
      }).catch(e => UI.toast(e.message, 'err'));
    }
  }
};

Pages.notifications = {
  title: 'Notifications',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Notifications';
    const box = el('div');
    async function load() {
      const res = await API.get('/notifications?pageSize=100');
      box.innerHTML = '';
      box.append(el('div', { class: 'btnrow mb' },
        el('button', { class: 'btn sm', onclick: async () => { await API.post('/notifications/read-all'); load(); App.refreshBell(); } }, 'Mark all read')),
        el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
          columns: [
            { key: '_dot', label: '', render: n => n.read_at ? '' : el('span', { style: 'color:var(--brand-2);font-size:18px' }, '●') },
            { key: 'title', label: 'Notification', render: n => el('div', {},
              el('b', { style: n.read_at ? 'font-weight:normal' : '' }, n.title),
              n.body ? el('div', { class: 'small muted' }, n.body) : null) },
            { key: 'entity_type', label: 'Entity', render: n => n.entity_type ? `${n.entity_type}${n.entity_id ? ' #' + n.entity_id : ''}` : '' },
            { key: 'created_at', label: 'When', render: n => UI.fmtDT(n.created_at) },
            { key: '_act', label: '', render: n => !n.read_at ? el('button', { class: 'btn sm', onclick: async () => { await API.post(`/notifications/${n.id}/read`); load(); App.refreshBell(); } }, 'Mark read') : null }
          ],
          rows: res.data,
          emptyText: 'No notifications',
          onRow: n => {
            if (!n.entity_type || !n.entity_id) return;
            const map = { DOCUMENT: '#/documents/', TRANSMITTAL: '#/transmittals/', CORRESPONDENCE: '#/correspondence', RESOLUTION: '#/resolutions', MEMO: '#/memos', NUMBER_ALLOCATION: '#/allocations' };
            const base = map[n.entity_type];
            if (base) location.hash = base + (base.endsWith('/') ? n.entity_id : '');
          }
        }))));
    }
    root.append(box);
    await load();
  }
};

Pages.audit = {
  title: 'Audit Trail',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Audit Trail';
    const state = { page: 1 };
    const actionsRes = await API.get('/audit/actions');
    const action = UI.select([['', 'All actions'], ...actionsRes.data.map(a => [a.action, a.action])]);
    const from = UI.input({ type: 'date' });
    const to = UI.input({ type: 'date' });
    const search = UI.input({ placeholder: 'User / details…' });
    for (const s of [action, from, to]) s.addEventListener('change', () => { state.page = 1; load(); });
    search.addEventListener('keydown', e => { if (e.key === 'Enter') { state.page = 1; load(); } });

    const box = el('div');
    root.append(
      el('div', { class: 'card mb' }, el('div', { class: 'bd frm-grid' },
        UI.field('Action', action), UI.field('From', from), UI.field('To', to), UI.field('Search', search))),
      el('p', { class: 'small muted' }, 'Audit records are append-only and cannot be altered or deleted by any user.'),
      box);

    async function load() {
      const qp = new URLSearchParams({ page: state.page, pageSize: 50 });
      if (action.value) qp.set('action', action.value);
      if (from.value) qp.set('from', from.value);
      if (to.value) qp.set('to', to.value);
      if (search.value) qp.set('search', search.value);
      const res = await API.get('/audit?' + qp.toString());
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'at', label: 'Timestamp', render: r => UI.fmtDT(r.at) },
          { key: 'username', label: 'User' },
          { key: 'action', label: 'Action', render: r => UI.badge(r.action, '#334155') },
          { key: 'entity_type', label: 'Entity', render: r => `${r.entity_type || ''}${r.entity_id ? ' #' + r.entity_id : ''}` },
          { key: 'prev_value', label: 'Previous → New value', render: r =>
            el('code', { class: 'mono small' }, JSON.stringify(r.prev_value ?? '') + '  →  ' + JSON.stringify(r.new_value ?? '').slice(0, 120)) },
          { key: 'ip', label: 'IP' }
        ],
        rows: res.data
      }), UI.pager({ ...res.meta, onChange: p => { state.page = p; load(); } }))));
    }
    await load();
  }
};
