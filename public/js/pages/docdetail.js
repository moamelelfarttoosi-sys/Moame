/* Document detail workspace */
window.Pages = window.Pages || {};
Pages.docdetail = {
  async render(root, params) {
    const id = params[0];
    let d;
    const load = async () => {
      d = (await API.get('/documents/' + id)).data;
      render();
    };

    function header() {
      return el('div', { class: 'card mb', style: 'padding:14px 18px' },
        el('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' },
          el('div', { style: 'flex:1;min-width:260px' },
            el('div', { class: 'mono', style: 'font-size:15px;font-weight:700' }, d.doc_number),
            el('div', { style: 'font-size:16px;margin-top:2px' }, d.title)),
          UI.badge(d.internal_status_name + ' (' + d.internal_status_code + ')', d.internal_status_color),
          d.external_status_code ? UI.el('span', { class: 'tag' }, 'Ext: ' + d.external_status_name) : null,
          el('span', { class: 'tag' }, 'Rev ' + ((d.revisions.find(r => r.is_current) || {}).revision_code || '-')),
          el('span', { class: 'tag' }, d.doc_type_code),
          el('span', { class: 'tag' }, d.project_code)
        ),
        el('div', { class: 'btnrow mt' }, actionButtons()));
    }

    function actionButtons() {
      const btns = [];
      if (API.can('document.status')) {
        btns.push(el('button', { class: 'btn primary', onclick: submitReviewModal }, 'Submit for Review'));
        btns.push(el('button', { class: 'btn', onclick: statusChangeModal }, 'Status change'));
      }
      if (API.can('document.revise')) btns.push(el('button', { class: 'btn', onclick: newRevisionModal }, 'New Revision'));
      if (API.can('transmittal.create')) btns.push(el('button', { class: 'btn', onclick: createTransmittalFromDoc }, 'Create Transmittal'));
      if (API.can('archive.manage') && ['SUP', 'CLS'].includes(d.internal_status_code)) {
        btns.push(el('button', { class: 'btn', onclick: archiveDoc }, 'Archive'));
      }
      return btns;
    }

    async function submitReviewModal() {
      const [users] = await Promise.all([API.get('/lookups/users')]);
      const U = users.data;
      const reviewers = UI.select([['', '— auto (role)'], ...U.filter(u => u.role_code === 'REVIEWER').map(u => [u.id, u.full_name])]);
      const endorsers = UI.select([['', '— from document'], ...U.filter(u => u.role_code === 'ENDORSER').map(u => [u.id, u.full_name])]);
      const approvers = UI.select(U.filter(u => u.role_code === 'APPROVER').map(u => [u.id, u.full_name]), { multiple: true, size: Math.min(4, U.length) });
      const mode = UI.select([['sequential', 'Sequential'], ['parallel', 'Parallel']]);
      const due = UI.input({ type: 'date' });
      UI.modal('Submit for Technical Review & Approval', el('div', {},
        el('p', { class: 'muted small' }, 'Launches the configured DOC-TECH-APPROVAL workflow for the current revision.'),
        UI.field('Reviewer', reviewers), UI.field('Endorser', endorsers),
        el('label', { class: 'f' }, el('span', {}, 'Approvers *'), approvers),
        UI.field('Approval mode', mode), UI.field('Review due date', due)), {
        actions: [
          { label: 'Cancel', onClick: c => c() },
          {
            label: 'Submit', kind: 'primary', onClick: async close => {
              try {
                const assignments = {};
                if (reviewers.value) assignments.technical_review = reviewers.value;
                const selectedApprovers = [...approvers.selectedOptions].map(o => Number(o.value)).filter(Boolean);
                await API.post(`/documents/${id}/submit-review`, {
                  assignments,
                  approvers: selectedApprovers,
                  approval_mode: mode.value,
                  review_due_date: due.value || undefined
                });
                UI.toast('Workflow started', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }
        ]
      });
    }

    function statusChangeModal() {
      API.get('/lookups/statuses?active_only=1').then(res => {
        const to = UI.select(res.data.map(s => [s.id, `${s.name} (${s.scope})`]));
        const column = UI.select([['internal', 'Internal status'], ['external', 'External status']]);
        const reason = UI.input(); const comment = UI.textarea();
        UI.modal('Controlled Status Change', el('div', {},
          UI.field('Target status *', to, true),
          UI.field('Applies to *', column),
          UI.field('Reason *', reason, true),
          UI.field('Comment', comment)), {
          actions: [{ label: 'Cancel', onClick: c => c() },
            {
              label: 'Apply transition', kind: 'primary', onClick: async close => {
                try {
                  await API.post(`/documents/${id}/status`, {
                    to_status_id: Number(to.value), status_column: column.value,
                    reason: reason.value, comment: comment.value
                  });
                  UI.toast('Status updated', 'ok'); close(); load();
                } catch (e) { UI.toast(e.message, 'err'); }
              }
            }]
        });
      });
    }

    async function newRevisionModal() {
      const reason = UI.input();
      UI.modal(`Raise New Revision from Rev ${(d.revisions.find(r => r.is_current) || {}).revision_code}`, el('div', {},
        UI.field('Revision reason *', reason, true),
        el('p', { class: 'small muted' }, 'The current approved revision remains retrievable and will be superseded when the new revision is approved.')), {
        actions: [{ label: 'Cancel', onClick: c => c() },
          {
            label: 'Create revision', kind: 'primary', onClick: async close => {
              try {
                await API.post(`/documents/${id}/revisions`, { revision_reason: reason.value });
                UI.toast('New draft revision created', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
      });
    }

    function createTransmittalFromDoc() {
      location.hash = '#/transmittals';
      setTimeout(() => window.openTransmittalModal && openTransmittalModal(null, [d.id]), 350);
    }

    async function archiveDoc() {
      const reason = UI.input({ value: 'Closed per records schedule' });
      UI.modal('Archive Document', el('div', {}, UI.field('Reason', reason)), {
        actions: [{ label: 'Cancel', onClick: c => c() }, {
          label: 'Archive', kind: 'primary', onClick: async close => {
            try { await API.post(`/archive/documents/${id}/archive`, { reason: reason.value }); UI.toast('Archived', 'ok'); close(); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }

    /* ---------------- tabs ---------------- */
    let activeTab = 'overview';
    function render() {
      root.innerHTML = '';
      const cur = d.revisions.find(r => r.is_current);
      root.append(header());
      const tabs = ['Overview', 'File', 'Metadata', 'Revisions', 'Workflow', 'Reviews', 'Approvals', 'Transmittals', 'Related Records', 'Audit'];
      const bar = el('div', { class: 'tabs' }, tabs.map(t =>
        el('button', { class: t.toLowerCase() === activeTab ? 'active' : '', onclick: () => { activeTab = t.toLowerCase(); render(); } }, t)));
      const body = el('div');
      ({ overview: tabOverview, file: tabFile, metadata: tabMetadata, revisions: tabRevisions, workflow: tabWorkflow,
        reviews: tabReviews, approvals: tabApprovals, transmittals: tabTransmittals, related: tabRelated, audit: tabAudit }[activeTab] || tabOverview)(body);

      root.append(bar, body);
      document.querySelector('.topbar .title').textContent = d.doc_number;
    }

    function kv(pairs) {
      return el('dl', { class: 'kv' }, pairs.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v ?? '—')]));
    }

    function tabOverview(box) {
      box.append(el('div', { class: 'grid g2' },
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Identification')), el('div', { class: 'bd' },
          kv([
            ['Document number', el('b', { class: 'mono' }, d.doc_number)],
            ['Title', d.title],
            ['Direction', d.direction], ['Type', `${d.doc_type_code} — ${d.doc_type_name}`],
            ['Category', d.category_code || '—'], ['Discipline', d.discipline_name || '—'],
            ['Purpose of issue', d.purpose_name || '—'],
            ['Keywords', d.keywords || '—']
          ]))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Context')), el('div', { class: 'bd' },
          kv([
            ['Project', `${d.project_code} — ${d.project_name}`],
            ['Contract', d.contract_number || '—'],
            ['Customer', d.customer_org_name || '—'],
            ['Contractor', d.contractor_org_name || '—'],
            ['Originator', d.originator_org_name || '—'],
            ['Area / System / Phase', `${d.area || '—'} / ${d.system || '—'} / ${d.phase || '—'}`]
          ]))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Dates')), el('div', { class: 'bd' },
          kv([
            ['Document date', UI.fmtDate(d.document_date)], ['Receipt date', UI.fmtDate(d.receipt_date)],
            ['Accept date', UI.fmtDate(d.accept_date)], ['Due date', UI.fmtDate(d.due_date)],
            ['Review due date', UI.fmtDate(d.review_due_date)], ['Registered at', UI.fmtDT(d.registered_at)]
          ]))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'UEF Document Control')), el('div', { class: 'bd' },
          kv([
            ['Entry number', d.entry_number || '—'],
            ['Register', UI.badge(d.register_type || 'DCR', '#334155')],
            ['Numbering scheme', d.numbering_scheme ? UI.badge(d.numbering_scheme, d.numbering_scheme === 'CORPORATE' ? '#7c3aed' : '#1667d9') : '—'],
            ['PRID / SO-PO', `${d.prid || '—'} / ${d.so_po || '—'}`],
            ['Class', d.class_code || '—'],
            ['Department / Section', `${d.department_code || '—'} / ${d.section_code || '—'}`],
            ['Originator code', d.originator_code || '—'],
            ['Pages / Sheets', d.pages_sheets ?? '—'],
            ['Owner', d.owner_name || '—'],
            ['Supersedes', d.supersedes ? el('a', { href: '#/documents/' + d.supersedes.id }, d.supersedes.doc_number) : '—'],
            ['Superseded by', (d.superseded_by || []).map(s => el('a', { href: '#/documents/' + s.id, style: 'margin-right:8px' }, s.doc_number)).length ? d.superseded_by.map(s => el('a', { href: '#/documents/' + s.id, style: 'margin-right:8px' }, s.doc_number)) : '—'],
            ['Allocation', d.allocation ? el('span', { class: 'mono small' }, `${d.allocation.request_number} (${d.allocation.decision})`) : '—'],
            ['Archive location', d.archive_location || '—']
          ]))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Roles')), el('div', { class: 'bd' },
          kv([
            ['DCC', d.dcc_user_id ? (d.created_by_username || '') : '—'],
            ['Endorser', endorserName()], ['Reviewer', reviewerName()], ['Approver', approverName()],
            ['Retention class', d.retention_code || '—'],
            ['Confidentiality', d.confidentiality],
            ['Archive status', d.archive_status]
          ])))
      ));
      function endorserName() { const e = d.endorsements[0]; return e ? e.endorser_name : '—'; }
      function reviewerName() { const r = d.reviews[0]; return r ? r.reviewer_name : '—'; }
      function approverName() { const a = d.approvals[0]; if (!a) return '—'; const s = a.steps[a.steps.length - 1]; return s && s.approver_name ? s.approver_name : '—'; }
    }

    function tabFile(box) {
      const cur = d.revisions.find(r => r.is_current);
      const rows = [];
      for (const rev of [...d.revisions].sort((a, b) => a.id - b.id)) {
        for (const v of rev.versions) {
          rows.push({
            rev: rev.revision_code, ver: v.version_no, name: v.original_name, size: v.size_bytes,
            by: v.uploaded_by_name, at: v.uploaded_at, fileId: v.file_id, mime: v.mime_type, locked: ['APP', 'SUP', 'ARC'].includes(rev.status_code)
          });
        }
      }
      const tbl = el('div', {},
        el('h3', { style: 'margin:0 0 8px' }, 'Files & versions'),
        UI.table({
          columns: [
            { key: 'rev', label: 'Rev' }, { key: 'ver', label: 'Version' },
            { key: 'name', label: 'File name' },
            { key: 'size', label: 'Size', render: r => (r.size / 1024).toFixed(1) + ' KB' },
            { key: 'mime', label: 'MIME type' },
            { key: 'by', label: 'Uploaded by' },
            { key: 'at', label: 'At', render: r => UI.fmtDT(r.at) },
            {
              key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
                el('button', { class: 'btn sm', onclick: () => UI.downloadFile('/api/files/' + r.fileId) }, 'Download'),
                r.mime && r.mime.startsWith(('image/')) ? el('a', { class: 'btn sm', href: '/api/files/' + r.fileId + '?inline=1', target: '_blank' }, 'Preview')
                  : r.mime && r.mime.includes('pdf') ? el('a', { class: 'btn sm', href: '/api/files/' + r.fileId + '?inline=1', target: '_blank' }, 'Preview')
                  : null,
                !r.locked && API.can('document.edit') ? el('button', {
                  class: 'btn sm', onclick: () => replaceVersion(r)
                }, 'Replace') : null)
            }
          ],
          rows,
          emptyText: 'No files uploaded yet'
        }));

      const upBox = el('div', {});
      const uploadInput = el('input', { type: 'file', style: 'display:none', onchange: async () => {
        if (!uploadInput.files.length) return;
        const fd = new FormData(); fd.append('file', uploadInput.files[0]);
        try {
          await API.upload(`/documents/${d.id}/revisions/${cur.id}/versions/multipart`, uploadInput.files[0], 'Uploaded via UI');
          UI.toast('Version uploaded', 'ok'); load();
        } catch (e) { UI.toast(e.message, 'err'); }
      }});
      if (API.can('document.edit') && cur && !['APP', 'SUP', 'ARC'].includes(cur.status_code)) {
        upBox.append(el('button', { class: 'btn primary mb', onclick: () => uploadInput.click() }, 'Upload new version into current revision'), uploadInput);
      }
      box.append(upBox, el('div', { class: 'card' }, el('div', { class: 'bd' }, tbl)));
    }

    function replaceVersion(row) {
      const inp = el('input', { type: 'file', style: 'display:none', onchange: async () => {
        try {
          await API.upload(`/documents/${d.id}/revisions/${(d.revisions.find(x => x.revision_code === row.rev) || {}).id}/versions/multipart`, inp.files[0]);
          UI.toast('Replaced via new version', 'ok'); load();
        } catch (e) { UI.toast(e.message, 'err'); }
      }});
      document.body.append(inp); inp.click();
    }

    function tabMetadata(box) {
      const editable = API.can('document.edit') && d.archive_status !== 'archived';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' },
        kv(Object.entries({
          'Internal status': `${d.internal_status_name} (${d.internal_status_code})`,
          'External status': d.external_status_name || '—',
          Confidentiality: d.confidentiality, 'Security classification': d.security_classification || '—',
          Remarks: d.remarks || '—', 'Parent document': d.parent_document_id || '—',
          'Transmittal ref': d.transmittal_ref || '—', 'Correspondence ref': d.correspondence_ref || '—',
          'Created by': d.created_by_username, Registered: UI.fmtDT(d.registered_at), Updated: UI.fmtDT(d.updated_at)
        }).map(([k, v]) => [k, typeof v === 'string' || !v ? String(v ?? '—') : v]))
      )));
      if (editable) {
        box.append(el('div', { class: 'mt btnrow' },
          el('button', { class: 'btn', onclick: editMetaModal }, 'Edit metadata')));
      }
      function editMetaModal() {
        Promise.all([API.get('/lookups/purposes'), API.get('/lookups/disciplines')]).then(([pp, dd]) => {
          const purpose = UI.select([['', '—'], ...pp.data.map(x => [x.id, x.name])]);
          if (d.purpose_id) purpose.value = String(d.purpose_id);
          const area = UI.input({ value: d.area || '' });
          const system = UI.input({ value: d.system || '' });
          const keywords = UI.input({ value: d.keywords || '' });
          const remarks = UI.textarea({}, );
          remarks.value = d.remarks || '';
          UI.modal('Edit metadata', el('div', { class: 'frm-grid' },
            UI.field('Purpose of issue', purpose), UI.field('Area', area), UI.field('System', system),
            UI.field('Keywords', keywords), UI.field('Remarks', remarks)), {
            actions: [{ label: 'Cancel', onClick: c => c() }, {
              label: 'Save', kind: 'primary', onClick: async close => {
                try {
                  await API.put('/documents/' + d.id, {
                    purpose_id: purpose.value || undefined, area: area.value, system: system.value,
                    keywords: keywords.value, remarks: remarks.value
                  });
                  UI.toast('Metadata saved', 'ok'); close(); load();
                } catch (e) { UI.toast(e.message, 'err'); }
              }
            }]
          });
        });
      }
    }

    function tabRevisions(box) {
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'revision_code', label: 'Revision', render: r => el('b', {}, r.revision_code) },
          { key: 'status_name', label: 'Status', render: r => UI.badge(r.status_code + ' · ' + r.status_name, r.is_current ? '#1667d9' : '#94a3b8') },
          { key: 'revision_reason', label: 'Reason' },
          { key: 'revision_date', label: 'Date', render: r => UI.fmtDate(r.revision_date) },
          { key: 'author_name', label: 'Author' },
          { key: 'approver_name', label: 'Approved by' },
          { key: 'approval_date', label: 'Approval date', render: r => UI.fmtDate(r.approval_date) },
          { key: 'file_name', label: 'Controlled file', render: r => r.file_name ? `${r.file_name} (${(r.size_bytes / 1024).toFixed(0)} KB)` : '—' },
          { key: 'is_current', label: 'Current', render: r => r.is_current ? '✓' : '' }
        ],
        rows: d.revisions
      }))));
    }

    function tabWorkflow(box) {
      if (!d.workflow.length) { box.append(emptyCard('No workflow instances')); return; }
      for (const wfi of d.workflow) {
        box.append(el('div', { class: 'card mb' }, el('div', { class: 'hd' },
          el('h3', {}, `Workflow ${wfi.workflow_code} v${wfi.version_no}`),
          UI.badge(wfi.status, wfi.status === 'completed' ? '#16a34a' : wfi.status === 'running' ? '#c07f00' : '#dc2626'),
          el('span', { class: 'small muted' }, `started ${UI.fmtDT(wfi.started_at)}${wfi.completed_at ? ' · finished ' + UI.fmtDT(wfi.completed_at) : ''}`)),
          el('div', { class: 'bd' },
            el('ul', { class: 'timeline' }, wfi.steps.map(s => el('li', {
              class: s.status === 'completed' ? 'done' : s.status === 'rejected' ? 'rej' : ''
            },
              el('div', { class: 'tl-t' }, `#${s.seq_no} ${s.name} `, UI.badge(s.status, s.status === 'active' ? '#c07f00' : s.status === 'completed' ? '#16a34a' : s.status === 'rejected' ? '#dc2626' : '#94a3b8')),
              el('div', { class: 'tl-m' },
                `${s.step_type} → assignee ${s.assignee_type}:${s.assignee_value}`,
                s.deadline_at ? ` · due ${UI.fmtDT(s.deadline_at)}` : '',
                s.acted_by_name ? ` · acted by ${s.acted_by_name}` : '',
                s.comments ? ` · “${s.comments}”` : '')))))));
      }
    }

    function tabReviews(box) {
      if (!d.reviews.length) { box.append(emptyCard('No reviews yet')); return; }
      for (const r of d.reviews) {
        const comments = d.review_comments.filter(c => c.review_id === r.id);
        box.append(el('div', { class: 'card mb' }, el('div', { class: 'hd' },
          el('h3', {}, `Review by ${r.reviewer_name}`), UI.badge(r.status, r.status === 'approved' ? '#16a34a' : r.status === 'rejected' ? '#dc2626' : '#c07f00'),
          el('span', { class: 'small muted' }, `assigned ${UI.fmtDT(r.assigned_at)}${r.completed_at ? ' · completed ' + UI.fmtDT(r.completed_at) : ''}${r.review_due_date ? ' · due ' + r.review_due_date : ''}`)),
          el('div', { class: 'bd' },
            r.outcome_comments ? el('p', {}, el('b', {}, 'Outcome: '), r.outcome_comments) : null,
            comments.length ? el('ul', {}, comments.map(cm => el('li', {}, el('b', {}, cm.user_name + ': '), cm.comment))) : el('span', { class: 'muted small' }, 'No comments'))));
      }
    }

    function tabApprovals(box) {
      if (!d.approvals.length) { box.append(emptyCard('No approvals yet')); return; }
      for (const a of d.approvals) {
        box.append(el('div', { class: 'card mb' }, el('div', { class: 'hd' },
          el('h3', {}, `Approval #${a.id} (${a.mode})`),
          UI.badge(a.status, a.status === 'approved' ? '#16a34a' : a.status === 'rejected' ? '#dc2626' : '#c07f00'),
          el('span', { class: 'small muted' }, `initiated by ${a.initiated_by_name} ${UI.fmtDT(a.initiated_at)}`)),
          el('div', { class: 'bd' }, UI.table({
            columns: [
              { key: 'seq_no', label: '#' },
              { key: 'approver_name', label: 'Approver' },
              { key: 'status', label: 'Status', render: s => UI.badge(s.status, s.status === 'approved' ? '#16a34a' : s.status === 'pending' ? '#c07f00' : s.status === 'rejected' ? '#dc2626' : '#94a3b8') },
              { key: 'comments', label: 'Comments' },
              { key: 'acted_at', label: 'Acted at', render: s => UI.fmtDT(s.acted_at) }
            ],
            rows: a.steps
          }))));
      }
    }

    function tabTransmittals(box) {
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'trn_number', label: 'Transmittal' },
          { key: 'subject', label: 'Subject' },
          { key: 'status', label: 'Status', render: t => UI.badge(t.status, t.status === 'issued' ? '#c07f00' : t.status === 'acknowledged' ? '#1667d9' : '#64748b') },
          { key: 'trn_date', label: 'Date', render: t => UI.fmtDate(t.trn_date) }
        ],
        rows: d.transmittals,
        onRow: t => { location.hash = '#/transmittals/' + t.id; },
        emptyText: 'Not included in any transmittal'
      }))));
      if (d.correspondence_links.length) {
        box.append(el('h3', { class: 'mt' }, 'Linked correspondence'),
          UI.table({
            columns: [{ key: 'corr_number', label: 'Number' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }],
            rows: d.correspondence_links
          }));
      }
    }

    function tabRelated(box) {
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' },
        UI.table({
          columns: [
            { key: 'related_type', label: 'Type' }, { key: 'related_id', label: 'Record ID' },
            { key: 'link_note', label: 'Note' }, { key: 'created_at', label: 'Linked at', render: r => UI.fmtDT(r.created_at) }
          ],
          rows: d.related, emptyText: 'No related records'
        })),
        API.can('document.edit') ? el('div', { class: 'bd', style: 'border-top:1px solid var(--line)' },
          linkForm()) : null));

      function linkForm() {
        const type = UI.select([['DOCUMENT'], ['TRANSMITTAL'], ['CORRESPONDENCE']]);
        const rid = UI.input({ placeholder: 'Record id', type: 'number' });
        const note = UI.input({ placeholder: 'Note' });
        return el('div', { class: 'btnrow mt' }, type, rid, note,
          el('button', { class: 'btn primary sm', onclick: async () => {
            try { await API.post(`/documents/${d.id}/related`, { related_type: type.value, related_id: Number(rid.value), link_note: note.value }); UI.toast('Linked', 'ok'); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }}, 'Link record'));
      }
    }

    function tabAudit(box) {
      loadAudit().then(rows => box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'at', label: 'Timestamp', render: r => UI.fmtDT(r.at) },
          { key: 'username', label: 'User' },
          { key: 'action', label: 'Action', render: r => UI.badge(r.action, '#334155') },
          { key: 'details', label: 'Details', render: r => el('code', { class: 'mono small' }, JSON.stringify(r.details)) }
        ],
        rows
      })))));

      async function loadAudit() {
        const res = await API.get(`/audit?entity_type=DOCUMENT&entity_id=${id}&pageSize=100`);
        return res.data;
      }
    }

    function emptyCard(msg) {
      return el('div', { class: 'card' }, el('div', { class: 'bd empty' }, msg));
    }

    await load();
  }
};
