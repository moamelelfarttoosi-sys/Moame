/* Transmittals: register, create, issue, acknowledge */
window.Pages = window.Pages || {};
Pages.transmittals = {
  title: 'Transmittals',
  state: { page: 1 },
  async render(root) {
    const box = el('div');
    const state = { page: 1 };
    document.querySelector('.topbar .title').textContent = 'Outgoing Documents & Transmittals';

    async function load() {
      const res = await API.get('/transmittals?page=' + state.page + '&pageSize=25');
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' },
        UI.table({
          columns: [
            { key: 'trn_number', label: 'Transmittal No', render: r => el('b', { class: 'mono' }, r.trn_number) },
            { key: 'subject', label: 'Subject' },
            { key: 'direction', label: 'Dir' },
            { key: 'recipient_org_name', label: 'Recipient' },
            { key: 'trn_date', label: 'Date', render: r => UI.fmtDate(r.trn_date) },
            { key: 'status', label: 'Status', render: r => UI.badge(r.status, trnColor(r.status)) },
            { key: 'response_due_date', label: 'Response due', render: r => UI.fmtDate(r.response_due_date) }
          ],
          rows: res.data,
          onRow: r => { location.hash = '#/transmittals/' + r.id; }
        }),
        UI.pager({ ...res.meta, onChange: p => { state.page = p; load(); } }))));
    }

    if (API.can('transmittal.create')) {
      root.append(el('button', { class: 'btn primary mb', onclick: () => openTransmittalModal(load) }, '+ Create Transmittal'));
    }
    root.append(box);
    await load();
  }
};

function trnColor(s) {
  return { draft: '#94a3b8', issued: '#c07f00', acknowledged: '#1667d9', responded: '#0e9f6e', closed: '#334155', cancelled: '#dc2626' }[s] || '#64748b';
}

window.openTransmittalModal = async function openTransmittalModal(done, presetDocIds) {
  const [orgs, users, purps, docsRes] = await Promise.all([
    API.get('/lookups/organizations'), API.get('/lookups/users'),
    API.get('/lookups/purposes'), API.get('/documents?pageSize=200')
  ]).catch(e => { UI.toast(e.message, 'err'); throw e; });
  const O = orgs.data, U = users.data, P = purps.data;
  const docs = docsRes.data;

  const subject = UI.input();
  const recipOrg = UI.select([['', '—'], ...O.map(o => [o.id, o.name])]);
  const purpose = UI.select([['', '—'], ...P.map(p => [p.id, p.name])]);
  const respReq = el('input', { type: 'checkbox' });
  const respDue = UI.input({ type: 'date' });
  const comments = UI.textarea();

  const docChecks = docs.map(doc => {
    const cb = el('input', { type: 'checkbox', value: doc.id });
    if (presetDocIds && presetDocIds.includes(doc.id)) cb.checked = true;
    return el('label', { style: 'display:flex;gap:8px;align-items:flex-start;padding:4px 0;font-size:13px' },
      cb, el('span', {}, el('span', { class: 'mono' }, doc.doc_number), ` — ${doc.title} [${doc.internal_status_code}]`));
  });
  const docList = el('div', { style: 'max-height:220px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-top:4px' }, docChecks);

  const userChecks = U.filter(u => u.role_code !== 'ADMIN').map(u =>
    el('label', { style: 'display:flex;gap:8px;align-items:center;padding:2px 0;font-size:13px' },
      el('input', { type: 'checkbox', value: u.id, class: '_rcpt' }), u.full_name));
  const userList = el('div', { style: 'max-height:160px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px 12px;margin-top:4px' }, userChecks);

  UI.modal('Create Transmittal', el('div', {},
    el('div', { class: 'frm-grid' },
      UI.field('Subject *', subject, true),
      UI.field('Recipient organization *', recipOrg),
      UI.field('Purpose of issue', purpose),
      UI.field('Response required', respReq),
      UI.field('Response due date', respDue)),
    UI.field('Comments', comments),
    el('label', { class: 'f' }, el('span', { class: 'req' }, 'Documents (current revisions)'), docList),
    el('label', { class: 'f' }, el('span', {}, 'Distribution recipients (leave empty for org-level distribution)'), userList)), {
    lg: true,
    actions: [{ label: 'Cancel', onClick: c => c() }, {
      label: 'Create draft', kind: 'primary', onClick: async close => {
        try {
          const ids = [...docList.querySelectorAll('input:checked')].map(i => Number(i.value));
          const rids = [...userList.querySelectorAll('input:checked')].map(i => Number(i.value));
          await API.post('/transmittals', {
            subject: subject.value, recipient_org_id: recipOrg.value ? Number(recipOrg.value) : undefined,
            purpose_id: purpose.value ? Number(purpose.value) : undefined,
            response_required: respReq.checked, response_due_date: respDue.value || undefined,
            comments: comments.value || undefined,
            document_ids: ids, recipient_user_ids: rids
          });
          UI.toast('Draft transmittal created', 'ok'); close(); done && done();
        } catch (e) { UI.toast(e.message, 'err'); }
      }
    }]
  });
};

Pages.transmittaldetail = {
  async render(root, params) {
    const id = params[0];
    let t;
    const load = async () => { t = (await API.get('/transmittals/' + id)).data; render(); };

    function render() {
      root.innerHTML = '';
      document.querySelector('.topbar .title').textContent = t.trn_number;
      root.append(el('div', { class: 'card mb', style: 'padding:14px 18px' },
        el('div', { style: 'display:flex;gap:12px;align-items:center;flex-wrap:wrap' },
          el('div', { style: 'flex:1' },
            el('b', { class: 'mono', style: 'font-size:15px' }, t.trn_number),
            el('div', {}, t.subject)),
          UI.badge(t.status, trnColor(t.status))),
        el('dl', { class: 'kv mt' },
          el('dt', {}, 'Sender'), el('dd', {}, `${t.sender_name || ''} (${t.sender_org_name || ''})`),
          el('dt', {}, 'Recipient'), el('dd', {}, `${t.recipient_org_name || '—'} ${t.recipient_contact || ''}`),
          el('dt', {}, 'Purpose'), el('dd', {}, t.purpose_code || '—'),
          el('dt', {}, 'Date / Response due'), el('dd', {}, `${UI.fmtDate(t.trn_date)} · ${UI.fmtDate(t.response_due_date)}${t.response_required ? ' (response required)' : ''}`),
          el('dt', {}, 'Acknowledged'), el('dd', {}, UI.fmtDT(t.acknowledged_at))),
        el('div', { class: 'btnrow mt' },
          t.status === 'draft' && API.can('transmittal.issue') ? el('button', { class: 'btn primary', onclick: issue }, 'Issue Transmittal') : null,
          t.status === 'issued' ? el('button', { class: 'btn good', onclick: ack }, 'Acknowledge Receipt') : null,
          ['issued', 'acknowledged'].includes(t.status) ? el('button', { class: 'btn', onclick: respond }, 'Record Response') : null,
          !['closed', 'cancelled'].includes(t.status) && API.can('transmittal.issue') ? el('button', { class: 'btn danger', onclick: closeTrn }, 'Close') : null)));

      root.append(el('div', { class: 'grid g2' },
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Documents in this transmittal')), el('div', { class: 'bd' },
          UI.table({
            columns: [
              { key: 'doc_number', label: 'Document', render: i => el('a', { href: '#/documents/' + i.document_id, onclick: e => e.stopPropagation() }, i.doc_number) },
              { key: 'revision_code', label: 'Rev' },
              { key: 'item_action', label: 'Action' }
            ],
            rows: t.items
          }))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Distribution & acknowledgement')), el('div', { class: 'bd' },
          UI.table({
            columns: [
              { key: 'recipient_name', label: 'Recipient', render: x => x.recipient_name || x.recipient_org_name || '—' },
              { key: 'copy_type', label: 'Copy' },
              { key: 'status', label: 'Status', render: x => UI.badge(x.status, x.status === 'acknowledged' ? '#16a34a' : x.status === 'sent' ? '#c07f00' : '#94a3b8') },
              { key: 'acknowledged_at', label: 'Acknowledged at', render: x => UI.fmtDT(x.acknowledged_at) }
            ],
            rows: t.distributions
          })))));
    }

    async function issue() {
      try { await API.post(`/transmittals/${id}/issue`); UI.toast('Issued — notifications sent', 'ok'); load(); }
      catch (e) { UI.toast(e.message, 'err'); }
    }
    async function ack() {
      try { await API.post(`/transmittals/${id}/acknowledge`); UI.toast('Acknowledgement recorded', 'ok'); load(); }
      catch (e) { UI.toast(e.message, 'err'); }
    }
    function respond() {
      const c = UI.textarea({ placeholder: 'Response summary…' });
      UI.modal('Record response', el('div', {}, UI.field('Comments', c)), {
        actions: [{ label: 'Cancel', onClick: x => x() }, {
          label: 'Save', kind: 'primary', onClick: async close => {
            try { await API.post(`/transmittals/${id}/respond`, { comments: c.value }); UI.toast('Saved', 'ok'); close(); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }
    async function closeTrn() {
      try { await API.post(`/transmittals/${id}/close`); UI.toast('Closed', 'ok'); load(); }
      catch (e) { UI.toast(e.message, 'err'); }
    }
    await load();
  }
};
