/* Correspondence, Memos, Resolutions pages */
window.Pages = window.Pages || {};

Pages.correspondence = {
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Correspondence';
    const box = el('div');
    const state = { page: 1 };
    const dir = UI.select([['', 'All directions'], ['incoming', 'Incoming'], ['outgoing', 'Outgoing']]);
    dir.addEventListener('change', () => { state.page = 1; load(); });

    root.append(el('div', { class: 'btnrow mb' }, dir,
      API.can('correspondence.create') ? el('button', { class: 'btn primary', onclick: openCorrModal }, '+ Register Correspondence') : null), box);

    async function load() {
      const res = await API.get('/correspondence?page=' + state.page + (dir.value ? '&direction=' + dir.value : ''));
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'corr_number', label: 'Number', render: r => el('b', { class: 'mono' }, r.corr_number) },
          { key: 'subject', label: 'Subject' },
          { key: 'direction', label: 'Dir' },
          { key: 'counterparty_code', label: 'Counterparty' },
          { key: 'urgency', label: 'Urgency', render: r => r.urgency === 'urgent' ? UI.badge('URGENT', '#dc2626') : 'normal' },
          { key: 'reply_days_allowed', label: 'Reply Days' },
          { key: 'reply_due_date', label: 'Reply Due', render: r => UI.fmtDate(r.reply_due_date) },
          { key: 'days_overdue', label: 'Overdue', render: r => r.days_overdue > 0 ? UI.badge(r.days_overdue + 'd', '#dc2626') : '—' },
          { key: 'status', label: 'Status', render: r => UI.badge(r.status, r.status === 'closed' ? '#334155' : r.status === 'awaiting_response' ? '#c07f00' : '#1667d9') }
        ],
        rows: res.data,
        onRow: r => corrDetailModal(r.id)
      }), UI.pager({ ...res.meta, onChange: p => { state.page = p; load(); } }))));
    }

    async function corrDetailModal(id) {
      const c = (await API.get('/correspondence/' + id)).data;
      const statusSel = UI.select([['new'], ['in_progress'], ['awaiting_response'], ['responded'], ['closed']]);
      statusSel.value = c.status;
      UI.modal(`${c.corr_number} — ${c.direction}`, el('div', {},
        el('dl', { class: 'kv' },
          el('dt', {}, 'Entry / Subject'), el('dd', {}, `#${c.entry_number ?? '—'} · ${c.subject}`),
          el('dt', {}, 'From / To'), el('dd', {}, `${c.sender_org_name || c.sender_name || '—'} → ${c.recipient_org_name || c.recipient_name || '—'}`),
          el('dt', {}, 'Counterparty'), el('dd', {}, `${c.counterparty_code || '—'} ${c.counterparty_ref ? '· ref ' + c.counterparty_ref : ''}`),
          el('dt', {}, 'Type / Dates'), el('dd', {}, `${c.corr_type} · letter ${UI.fmtDate(c.letter_date)} · ${c.direction === 'incoming' ? 'received' : 'dispatched'} ${UI.fmtDate(c.received_date || c.corr_date)}`),
          el('dt', {}, 'Language / Dept'), el('dd', {}, `${c.language_code || '—'} · ${c.responsible_dept_code || '—'}`),
          el('dt', {}, 'Focal point'), el('dd', {}, c.focal_point_name || c.assigned_user_name || '—'),
          el('dt', {}, 'SLA'), el('dd', {}, `${c.reply_days_allowed ?? '—'} days → due ${UI.fmtDate(c.reply_due_date)} ${c.urgency === 'urgent' ? UI.badge('URGENT', '#dc2626') : ''}`),
          el('dt', {}, 'Days overdue'), el('dd', {}, c.days_overdue > 0 ? UI.badge(c.days_overdue + ' days overdue', '#dc2626') : '—'),
          el('dt', {}, 'Contractual'), el('dd', {}, `${c.contractual_notice ? 'NOTICE · ' : ''}${c.clause || ''}`),
          el('dt', {}, 'Archive box'), el('dd', {}, c.archive_box || '—'),
          el('dt', {}, 'Linked records'), el('dd', {}, c.links.length ? c.links.map(l => el('span', { class: 'tag mono' }, `${l.entity_type}:${l.reference || l.entity_id}`)) : '—')),
        el('hr', { class: 'sep' }),
        el('p', { style: 'white-space:pre-wrap' }, c.body || ''),
        el('hr', { class: 'sep' }),
        UI.field('Update status', statusSel)), {
        actions: [{ label: 'Close dialog', onClick: x => x() }, {
          label: 'Apply status', kind: 'primary', onClick: async close => {
            try { await API.put(`/correspondence/${id}/status`, { status: statusSel.value }); UI.toast('Updated', 'ok'); close(); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }

    function openCorrModal() {
      Promise.all([API.get('/lookups/organizations'), API.get('/lookups/users'), API.get('/documents?pageSize=200'),
        UEF.codeOptions('ORIGINATOR'), UEF.codeOptions('DEPARTMENT'), UEF.codeOptions('LANGUAGE')]).then(([oo, uu, dd, cps, deps, langs]) => {
        const direction = UI.select([['incoming', 'Incoming'], ['outgoing', 'Outgoing']]);
        const subject = UI.input();
        const type = UI.select([['Letter'], ['Email'], ['Fax'], ['Notice'], ['Instruction']]);
        const sender = UI.select([['', '—'], ...oo.data.map(o => [o.id, o.name])]);
        const recipient = UI.select([['', '—'], ...oo.data.map(o => [o.id, o.name])]);
        const respReq = el('input', { type: 'checkbox' });
        const respDue = UI.input({ type: 'date' });
        const assigned = UI.select([['', '—'], ...uu.data.map(u => [u.id, u.full_name])]);
        const bodyT = UI.textarea();
        // UEF SLA fields
        const cparty = UI.select(cps);
        const cpartyRef = UI.input({ placeholder: "Counterparty's own reference" });
        const urgency = UI.select([['normal', 'Normal'], ['urgent', 'Urgent (3-day rule)']]);
        const letterDate = UI.input({ type: 'date' });
        const receivedDate = UI.input({ type: 'date' });
        const lang = UI.select(langs); lang.value = 'EN';
        const respDept = UI.select(deps);
        const focal = UI.select([['', '—'], ...uu.data.map(u => [u.id, u.full_name])]);
        const clause = UI.input({ placeholder: 'Contractual clause, e.g. Art. 12.4' });
        const notice = el('input', { type: 'checkbox' });
        const archiveBox = UI.input();
        const linkDocs = dd.data.slice(0, 100).map(d =>
          el('label', { style: 'display:flex;gap:8px;font-size:13px;padding:2px 0' },
            el('input', { type: 'checkbox', value: d.id, class: '_ldoc' }), `${d.doc_number} — ${d.title}`));
        const links = el('div', { style: 'max-height:150px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px 12px' }, linkDocs);
        UI.modal('Register Correspondence', el('div', {},
          el('div', { class: 'frm-grid' },
            UI.field('Direction *', direction), UI.field('Subject *', subject, true),
            UI.field('Type', type), UI.field('Sender organization', sender),
            UI.field('Recipient organization', recipient), UI.field('Assign to', assigned),
            UI.field('Response required', respReq), UI.field('Response due date', respDue)),
          el('hr', { class: 'sep' }),
          el('b', {}, 'UEF Correspondence Control'),
          el('p', { class: 'small muted', style: 'margin:4px 0 8px' }, 'Reply due date is calculated from configurable SLA rules: BOC/MOO/UEG = 7 days · Contractors/Vendors = 10 days · Urgent = 3 days.'),
          el('div', { class: 'frm-grid' },
            UI.field('Counterparty *', cparty), UI.field('Counterparty reference', cpartyRef),
            UI.field('Urgency', urgency), UI.field('Letter date', letterDate),
            UI.field('Date received / dispatched', receivedDate),
            UI.field('Language', lang), UI.field('Responsible department', respDept),
            UI.field('Focal point', focal),
            UI.field('Contractual clause', clause), UI.field('Contractual notice', notice),
            UI.field('Archive box', archiveBox)),
          UI.field('Body', bodyT),
          el('label', { class: 'f' }, el('span', {}, 'Link documents'), links)), {
          lg: true,
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Register', kind: 'primary', onClick: async close => {
              try {
                const res = await API.post('/correspondence', {
                  direction: direction.value, subject: subject.value, corr_type: type.value,
                  sender_org_id: sender.value || undefined, recipient_org_id: recipient.value || undefined,
                  assigned_user_id: assigned.value || undefined,
                  response_required: respReq.checked, response_due_date: respDue.value || undefined,
                  body: bodyT.value,
                  counterparty_code: cparty.value || undefined, counterparty_ref: cpartyRef.value || undefined,
                  urgency: urgency.value, letter_date: letterDate.value || undefined,
                  received_date: receivedDate.value || undefined,
                  language_code: lang.value || undefined, responsible_dept_code: respDept.value || undefined,
                  focal_point_user_id: focal.value || undefined,
                  clause: clause.value || undefined, contractual_notice: notice.checked,
                  archive_box: archiveBox.value || undefined,
                  links: [...links.querySelectorAll('input:checked')].map(i => ({ entity_type: 'DOCUMENT', entity_id: Number(i.value) }))
                });
                UI.toast(`Registered — reply due ${res.data.reply_due_date} (${res.data.reply_days_allowed} days)`, 'ok');
                close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      });
    }
    await load();
  }
};

Pages.memos = {
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Office Memoranda';
    const box = el('div');
    root.append(el('div', { class: 'btnrow mb' },
      API.can('memo.create') ? el('button', { class: 'btn primary', onclick: openMemoModal }, '+ New Memo') : null), box);

    async function load() {
      const res = await API.get('/memos');
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'memo_number', label: 'Memo No', render: r => el('b', { class: 'mono' }, r.memo_number) },
          { key: 'subject', label: 'Subject' },
          { key: 'from_name', label: 'From' },
          { key: 'department_name', label: 'Department' },
          { key: 'memo_date', label: 'Date', render: r => UI.fmtDate(r.memo_date) },
          { key: 'priority', label: 'Priority' },
          { key: 'status', label: 'Status', render: r => UI.badge(r.status, r.status === 'issued' ? '#16a34a' : '#94a3b8') }
        ],
        rows: res.data,
        onRow: async m => {
          const full = (await API.get('/memos/' + m.id)).data;
          UI.modal(m.memo_number, el('div', {},
            el('h3', { style: 'margin-top:0' }, full.subject),
            el('dl', { class: 'kv' },
              el('dt', {}, 'From'), el('dd', {}, full.from_name),
              el('dt', {}, 'To'), el('dd', {}, full.recipients.filter(x => x.kind === 'to').map(x => x.full_name).join(', ') || '—'),
              el('dt', {}, 'CC'), el('dd', {}, full.recipients.filter(x => x.kind === 'cc').map(x => x.full_name).join(', ') || '—'),
              el('dt', {}, 'Date / Priority'), el('dd', {}, `${UI.fmtDate(full.memo_date)} · ${full.priority}`),
              el('dt', {}, 'Status'), el('dd', {}, full.status)),
            el('hr', { class: 'sep' }),
            el('div', { style: 'white-space:pre-wrap' }, full.body)), {});
        }
      }))));
    }

    function openMemoModal() {
      API.get('/lookups/users').then(us => {
        const U = us.data;
        const subject = UI.input();
        const priority = UI.select([['Normal'], ['Low'], ['High'], ['Urgent']]);
        const toChecks = U.map(u => el('label', { style: 'display:flex;gap:8px;font-size:13px' }, el('input', { type: 'checkbox', value: u.id, class: '_to' }), u.full_name));
        const ccChecks = U.map(u => el('label', { style: 'display:flex;gap:8px;font-size:13px' }, el('input', { type: 'checkbox', value: u.id, class: '_cc' }), u.full_name));
        const bodyT = UI.textarea({ style: 'min-height:140px' });
        const pick = (cls, label) => el('label', { class: 'f' }, el('span', {}, label),
          el('div', { style: 'max-height:130px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:6px 12px;display:grid;grid-template-columns:1fr 1fr' }, checks));
        function checks() { return cls === '_to' ? toChecks : ccChecks; }
        UI.modal('New Office Memo', el('div', {},
          UI.field('Subject *', subject, true),
          el('div', { class: 'frm-grid' }, UI.field('Priority', priority)),
          pick('_to', 'To *'), pick('_cc', 'CC'),
          UI.field('Body *', bodyT, true)), {
          lg: true,
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Create & Issue', kind: 'primary', onClick: async close => {
              try {
                const to_users = [...document.querySelectorAll('._to:checked')].map(i => Number(i.value));
                const cc_users = [...document.querySelectorAll('._cc:checked')].map(i => Number(i.value));
                const res = await API.post('/memos', { subject: subject.value, priority: priority.value, to_users, cc_users, body: bodyT.value });
                await API.post(`/memos/${res.data.id}/issue`);
                UI.toast('Memo issued and distributed', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      });
    }
    await load();
  }
};

Pages.resolutions = {
  async render(root, params, query) {
    document.querySelector('.topbar .title').textContent = 'Resolutions & Decision Register';
    const box = el('div');
    const mine = query.mine === '1';
    root.append(el('div', { class: 'btnrow mb' },
      API.can('resolution.create') ? el('button', { class: 'btn primary', onclick: openResModal }, '+ New Resolution') : null), box);

    async function load() {
      const res = await API.get('/resolutions?pageSize=50' + (mine ? '&mine=1' : ''));
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'resolution_number', label: 'Number', render: r => el('b', { class: 'mono' }, r.resolution_number) },
          { key: 'subject', label: 'Subject' },
          { key: 'responsible_name', label: 'Responsible' },
          { key: 'due_date', label: 'Due', render: r => UI.fmtDate(r.due_date) },
          { key: 'priority', label: 'Priority' },
          { key: 'status', label: 'Status', render: r => UI.badge(r.status, { open: '#1667d9', in_progress: '#c07f00', escalated: '#dc2626', completed: '#0e9f6e', closed: '#334155' }[r.status] || '#64748b') },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm', onclick: () => detail(r.id) }, 'Open') }
        ],
        rows: res.data
      }))));

      async function detail(id) {
        const x = (await API.get('/resolutions/' + id)).data;
        const comment = UI.textarea();
        UI.modal(`${x.resolution_number} — ${x.subject}`, el('div', {},
          el('dl', { class: 'kv' },
            el('dt', {}, 'Decision'), el('dd', {}, x.decision),
            el('dt', {}, 'Action required'), el('dd', {}, x.action_required || '—'),
            el('dt', {}, 'Responsible'), el('dd', {}, x.responsible_name),
            el('dt', {}, 'Due / Priority'), el('dd', {}, `${UI.fmtDate(x.due_date)} · ${x.priority}`),
            el('dt', {}, 'Status'), el('dd', {}, x.status + (x.closure_date ? ` (closed ${x.closure_date})` : '')),
            el('dt', {}, 'Evidence'), el('dd', {}, x.evidence_file_id ? el('a', { href: '#', onclick: e => { e.preventDefault(); UI.downloadFile('/api/files/' + x.evidence_file_id); } }, x.evidence_name) : '—')),
          el('hr', { class: 'sep' }),
          el('b', {}, 'Comments'),
          el('ul', {}, x.comments.map(c => el('li', {}, el('b', {}, c.user_name + ': '), c.comment))),
          UI.field('Add comment', comment)), {
          lg: true,
          actions: [
            { label: 'Close dialog', onClick: c => c() },
            ['open', 'in_progress'].includes(x.status) && !mine ? null : null,
            ['open'].includes(x.status) ? { label: 'Start progress', onClick: async c2 => { try { await API.post(`/resolutions/${id}/progress`); UI.toast('In progress', 'ok'); c2(); load(); } catch (e) { UI.toast(e.message, 'err'); } } } : null,
            ['open', 'in_progress', 'escalated'].includes(x.status) ? {
              label: 'Complete & Close', kind: 'good', onClick: async c2 => {
                try {
                  if (comment.value.trim()) await API.post(`/resolutions/${id}/comments`, { comment: comment.value });
                  await API.post(`/resolutions/${id}/close`, { closure_comments: comment.value || 'Completed' });
                  UI.toast('Closed', 'ok'); c2(); load();
                } catch (e) { UI.toast(e.message, 'err'); }
              }
            } : null
          ].filter(Boolean)
        });
      }
    }

    function openResModal() {
      Promise.all([API.get('/lookups/users'), API.get('/lookups/departments')]).then(([us, ds]) => {
        const subject = UI.input();
        const decision = UI.textarea();
        const action = UI.input();
        const responsible = UI.select(us.data.map(u => [u.id, u.full_name]));
        const dept = UI.select([['', '—'], ...ds.data.map(x => [x.id, x.name])]);
        const due = UI.input({ type: 'date' });
        const priority = UI.select([['Normal'], ['Low'], ['High'], ['Urgent']]);
        const meeting = UI.input({ placeholder: 'e.g. Weekly Progress Meeting #42' });
        UI.modal('New Resolution / Decision', el('div', { class: 'frm-grid' },
          UI.field('Subject *', subject, true),
          UI.field('Meeting reference', meeting),
          UI.field('Decision *', decision, true),
          UI.field('Action required', action),
          UI.field('Responsible person *', responsible, true),
          UI.field('Department', dept),
          UI.field('Due date', due),
          UI.field('Priority', priority)), {
          lg: true,
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Create', kind: 'primary', onClick: async close => {
              try {
                await API.post('/resolutions', {
                  subject: subject.value, decision: decision.value, action_required: action.value || undefined,
                  responsible_user_id: Number(responsible.value), department_id: dept.value ? Number(dept.value) : undefined,
                  due_date: due.value || undefined, priority: priority.value, meeting_ref: meeting.value || undefined
                });
                UI.toast('Resolution created — assignee notified', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      });
    }
    await load();
  }
};
