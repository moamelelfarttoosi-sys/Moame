/* Documents register (all / incoming LOIR / outgoing) — Enhanced */
window.Pages = window.Pages || {};
Pages.documents = {
  title: 'Document Register',
  async render(root, params, query) {
    const direction = query.direction || '';
    if (direction === 'incoming') root.dataset.title = 'Incoming Documents — LOIR';
    else if (direction === 'outgoing') root.dataset.title = 'Outgoing Documents';
    document.querySelector('.topbar .title').textContent =
      direction === 'incoming' ? 'Incoming Document Registration (LOIR)' :
      direction === 'outgoing' ? 'Outgoing Documents' : 'Document Register';

    const state = { page: 1, pageSize: 25 };
    const filtersBox = el('div', { class: 'mb' });
    const listBox = el('div');
    let lookups;

    async function loadLookups() {
      const [projCodes, types, statuses, disciplines] = await Promise.all([
        API.get('/codes/PROJECT'), API.get('/codes/DOCTYPE'),
        API.get('/lookups/statuses?active_only=1'), API.get('/codes/DISCIPLINE')
      ]);
      lookups = {
        projects: projCodes.data.filter(c => c.lifecycle === 'active').map(c => ({ id: c.code, code: c.code, name: c.description })),
        types: types.data.filter(c => c.lifecycle === 'active').map(c => ({ id: c.id, code: c.code, name: c.description })),
        statuses: statuses.data.filter(s => s.scope !== 'external'),
        disciplines: disciplines.data.filter(c => c.lifecycle === 'active').map(c => ({ id: c.id, code: c.code, name: c.description }))
      };
    }

    function buildFilters() {
      const q = UI.input({ value: query.search || '', placeholder: 'Search number or title…', onkeydown: e => { if (e.key === 'Enter') { state.page = 1; load(); } } });
      const proj = UI.select([['', 'All projects'], ...lookups.projects.map(p => [p.id, `${p.code} — ${p.name}`])]);
      const typ = UI.select([['', 'All types'], ...lookups.types.map(p => [p.id, `${p.code} — ${p.name}`])]);
      const st = UI.select([['', 'Any status'], ...lookups.statuses.map(p => [p.id, `${p.code} — ${p.name}`])]);
      const dis = UI.select([['', 'All disciplines'], ...lookups.disciplines.map(p => [p.id, p.name])]);
      for (const s of [proj, typ, st, dis]) s.addEventListener('change', () => { state.page = 1; load(); });
      filtersBox.append(el('div', { class: 'card' }, el('div', { class: 'bd frm-grid' },
        UI.field('Search', q), UI.field('Project (PRID)', proj), UI.field('Document type', typ),
        UI.field('Internal status', st), UI.field('Discipline', dis))));
      filtersBox._get = () => ({
        search: q.value.trim(), prid: proj.value, doc_type_id: typ.value,
        internal_status_id: st.value, discipline_id: dis.value
      });
      filtersBox._reset = () => { q.value = ''; proj.value = ''; typ.value = ''; st.value = ''; dis.value = ''; };
    }

    async function load() {
      const f = filtersBox._get ? filtersBox._get() : {};
      const qp = new URLSearchParams({ page: state.page, pageSize: state.pageSize, ...f, ...(direction ? { direction } : {}) });
      const res = await API.get('/documents?' + qp.toString());
      listBox.innerHTML = '';
      const hasFilters = filtersBox._get && Object.values(filtersBox._get()).some(Boolean);
      listBox.append(
        UI.table({
          columns: [
            { key: 'doc_number', label: 'Document Number', render: r => el('span', { class: 'mono', style: 'font-size:12px' }, r.doc_number || '—') },
            { key: 'revision_label', label: 'Rev', className: 'nowrap' },
            { key: 'title', label: 'Title', render: r => el('span', { class: 'truncate', title: r.title }, r.title || '—') },
            { key: 'internal_status_code', label: 'Int. Status', render: r => UI.statusPill(r.internal_status_code) },
            { key: 'external_status_code', label: 'Ext. Status', render: r => r.external_status_code ? UI.statusPill(r.external_status_code) : el('span', { class: 'muted' }, '—') },
            { key: 'doc_type_code', label: 'Type', render: r => r.doc_type_code ? el('span', { class: 'tag' }, r.doc_type_code) : '—' },
            { key: 'project_code', label: 'Project', className: 'nowrap' },
            { key: 'receipt_date', label: 'Received', className: 'nowrap', render: r => UI.fmtDate(r.receipt_date) },
            { key: 'reviewer_name', label: 'Reviewer', render: r => r.reviewer_name || el('span', { class: 'muted' }, '—') },
            {
              key: '_act', label: '', className: 'actions', render: r => UI.moreMenu([
                { label: 'Open document', icon: '↗', onClick: () => { location.hash = '#/documents/' + r.id; } },
                { label: 'Create transmittal', icon: '📤', onClick: () => { location.hash = '#/transmittals'; } },
                { sep: true },
                { label: 'Copy number', icon: '⧉', onClick: () => { navigator.clipboard?.writeText(r.doc_number || '').then(() => UI.toast('Number copied', 'ok')).catch(() => {}); } }
              ])
            }
          ],
          rows: res.data,
          empty: hasFilters
            ? { icon: '🔍', title: 'No documents match your filters', message: 'Try broadening or clearing the filters above.', actions: [el('button', { class: 'btn', onclick: () => { filtersBox._reset && filtersBox._reset(); state.page = 1; load(); } }, 'Clear filters')] }
            : { icon: '📄', title: 'No documents registered yet', message: API.can('document.create') ? 'Register your first controlled document to build the register.' : 'No documents are available to view.', actions: API.can('document.create') ? [el('button', { class: 'btn primary', onclick: () => openRegisterModal(load) }, '＋ Register Document')] : [] },
          onRow: r => { location.hash = '#/documents/' + r.id; }
        }),
        UI.pager({ ...res.meta, onChange: p => { state.page = p; load(); } })
      );
    }

    await loadLookups();
    buildFilters();

    // Page header — primary action + grouped secondary actions
    const headActions = [];
    if (API.can('document.create')) {
      headActions.push(el('button', { class: 'btn primary', onclick: () => openRegisterModal(load) }, '＋ Register Document'));
      headActions.push(UI.moreMenu([
        { label: 'Scan & Import', icon: '📷', onClick: () => openScanImportModal(load) },
        { label: 'Import from Outlook', icon: '📧', onClick: () => openEmailImportModal(load) }
      ], { label: 'Import ▾' }));
    }
    if (API.can('document.view')) {
      headActions.push(UI.moreMenu([
        { label: 'Export to Excel (CSV)', icon: '📊', onClick: () => exportDocumentRegister() },
        { label: 'Export CSV', icon: '📄', onClick: () => exportCSV() },
        { sep: true },
        { label: 'Print register', icon: '🖨', onClick: () => printRegister() }
      ], { label: 'Export ▾' }));
    }
    const heading = direction === 'incoming' ? 'Incoming Documents (LOIR)'
      : direction === 'outgoing' ? 'Outgoing Documents' : 'Document Register (DCR)';
    const subtitle = direction === 'incoming'
      ? 'Log of Incoming Records — every document received into document control.'
      : 'The authoritative register of controlled documents across all projects and disciplines.';

    root.append(
      UI.pageHeader({ title: heading, desc: subtitle, actions: headActions }),
      filtersBox, listBox
    );
    await load();
  }
};

/* ============================================================
   ENHANCED REGISTRATION MODAL — Drag & Drop + Multi-File
   ============================================================ */
async function openRegisterModal(done) {
  const [contracts, docTypes, cats, discs, orgs, purps, rets, users, classes, depts, sections, originators, projCodes] = await Promise.all([
    API.get('/lookups/contracts'), API.get('/codes/DOCTYPE'),
    API.get('/lookups/categories'), API.get('/codes/DISCIPLINE'),
    API.get('/lookups/organizations'), API.get('/lookups/purposes'),     API.get('/lookups/retention_rules'),
    API.get('/lookups/users'), UEF.codeOptions('CLASS'), UEF.codeOptions('DEPARTMENT'),
    UEF.codeOptions('SECTION'), UEF.codeOptions('ORIGINATOR'), API.get('/codes/PROJECT')
  ]).catch(e => { UI.toast(e.message, 'err'); throw e; });
  const C = contracts.data, CA = cats.data,
    O = orgs.data, P = purps.data, R = rets.data, U = users.data;
  const T = docTypes.data.filter(c => c.lifecycle === 'active');
  const DI = discs.data.filter(c => c.lifecycle === 'active');
  const PC = projCodes.data.filter(c => c.lifecycle === 'active');

  const v = {};
  const mk = (name, node) => { v[name] = node; return node; };

  // File collection for multi-file upload
  let pendingFiles = [];

  // Drag-and-drop zone
  const dropZone = el('div', {
    class: 'drop-zone',
    style: 'border:2px dashed #94a3b8;border-radius:8px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:12px;background:#f8fafc',
    ondragover: e => { e.preventDefault(); dropZone.style.borderColor = '#1667d9'; dropZone.style.background = '#eff6ff'; },
    ondragleave: e => { dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; },
    ondrop: e => { e.preventDefault(); dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; handleFiles(e.dataTransfer.files); },
    onclick: () => fileInput.click()
  },
    el('div', { style: 'font-size:32px;margin-bottom:8px' }, '📁'),
    el('div', { style: 'font-size:14px;color:#475569' }, 'Drag & drop files here or click to browse'),
    el('div', { style: 'font-size:12px;color:#94a3b8;margin-top:4px' }, 'PDF, Word, Excel, PowerPoint, Images — Max 200 MB each')
  );

  const fileInput = el('input', {
    type: 'file', multiple: true, style: 'display:none',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf,.tif,.tiff,.jpg,.jpeg,.png,.msg,.eml,.zip,.txt,.csv,.rtf',
    onchange: () => handleFiles(fileInput.files)
  });

  const fileList = el('div', { style: 'margin-top:8px' });

  function handleFiles(files) {
    for (const f of files) {
      if (f.size > 200 * 1024 * 1024) {
        UI.toast(`File "${f.name}" exceeds 200 MB limit`, 'err');
        continue;
      }
      if (pendingFiles.some(p => p.name === f.name && p.size === f.size)) {
        UI.toast(`File "${f.name}" already added`, 'err');
        continue;
      }
      pendingFiles.push(f);
    }
    renderFileList();
    fileInput.value = '';
  }

  function renderFileList() {
    fileList.innerHTML = '';
    if (!pendingFiles.length) return;
    fileList.append(el('div', { style: 'font-size:13px;font-weight:600;margin-bottom:6px' }, `📎 ${pendingFiles.length} file(s) selected:`));
    pendingFiles.forEach((f, i) => {
      const row = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid #e2e8f0' },
        el('span', { style: 'flex:1' }, f.name),
        el('span', { style: 'color:#64748b' }, (f.size / 1024).toFixed(1) + ' KB'),
        el('button', { class: 'btn sm', style: 'color:#dc2626', onclick: () => { pendingFiles.splice(i, 1); renderFileList(); } }, '✕')
      );
      fileList.append(row);
    });
  }

  const form = el('div', { class: 'frm-grid' },
    dropZone, fileInput, fileList,
    el('hr', { class: 'sep' }),
    UI.field('Direction', mk('direction', UI.select([['incoming', 'Incoming'], ['outgoing', 'Outgoing'], ['internal', 'Internal']]))),
    UI.field('Title *', mk('title', UI.input()), true),
    UI.field('Project *', mk('prid', UI.select([['', '— Select Project —'], ...PC.map(c => [c.code, `${c.code} — ${c.description}`])])), true),
    UI.field('Contract', mk('contract_id', UI.select([['', '—'], ...C.map(x => [x.id, x.number + ' — ' + x.title])]))),
    UI.field('Document type *', mk('doc_type_id', UI.select([['', '—'], ...T.map(x => [x.id, x.code + ' — ' + x.description])])), true),
    UI.field('Category', mk('category_id', UI.select([['', '—'], ...CA.map(x => [x.id, x.name])]))),
    UI.field('Discipline', mk('discipline_id', UI.select([['', '—'], ...DI.map(x => [x.id, x.code + ' — ' + x.description])]))),
    UI.field('Department', mk('department_code', UI.select(depts))),
    UI.field('Recipient organization *', mk('originator_org_id', UI.select([['', '—'], ...O.map(x => [x.id, x.name])])), true),
    UI.field('Customer', mk('customer_org_id', UI.select([['', '—'], ...O.map(x => [x.id, x.name])]))),
    UI.field('Contractor', mk('contractor_org_id', UI.select([['', '—'], ...O.map(x => [x.id, x.name])]))),
    UI.field('Purpose of issue', mk('purpose_id', UI.select([['', '—'], ...P.map(x => [x.id, x.name])]))),
    UI.field('System', mk('system', UI.input())), UI.field('Area', mk('area', UI.input())),
    UI.field('Phase', mk('phase', UI.input({ value: 'Detailed Design' }))),
    UI.field('Receipt date', mk('receipt_date', UI.input({ type: 'date' }))),
    UI.field('Review due date', mk('review_due_date', UI.input({ type: 'date' }))),
    UI.field('Retention class', mk('retention_rule_id', UI.select([['', '—'], ...R.map(x => [x.id, x.name])]))),
    UI.field('Confidentiality', mk('confidentiality', UI.select([['Public'], ['Internal'], ['Confidential'], ['Strictly Confidential']]))),
    UI.field('Keywords', mk('keywords', UI.input())),
    UI.field('Reviewer', mk('reviewer_user_id', UI.select([['', '—'], ...U.filter(u => ['REVIEWER'].includes(u.role_code)).map(u => [u.id, u.full_name])]))),
    UI.field('Endorser', mk('endorser_user_id', UI.select([['', '—'], ...U.filter(u => u.role_code === 'ENDORSER').map(u => [u.id, u.full_name])]))),
    UI.field('Approver', mk('approver_user_id', UI.select([['', '—'], ...U.filter(u => u.role_code === 'APPROVER').map(u => [u.id, u.full_name])])))
  );

  // UEF Document Control extension
  const uefForm = el('div', { class: 'frm-grid' },
    UI.field('Register', mk('register_type', UI.select([['DCR', 'DCR — Document Control'], ['TDR', 'TDR — Technical'], ['MDR', 'MDR — Management'], ['VDR', 'VDR — Vendor'], ['SOP', 'SOP / Corporate']]))),
    UI.field('Class', mk('class_code', UI.select(classes))),
    UI.field('Department (UEF)', mk('uef_department_code', UI.select(depts))),
    UI.field('Section', mk('section_code', UI.select(sections))),
    UI.field('Originator / Counterparty', mk('originator_code', UI.select(originators))),
    UI.field('SO / PO', mk('so_po', UI.input())),
    UI.field('Pages / Sheets', mk('pages_sheets', UI.input({ type: 'number', min: '0' }))),
    UI.field('Supersedes document ID', mk('supersedes_document_id', UI.input({ type: 'number' }))),
    UI.field('Archive location', mk('archive_location', UI.input()))
  );
  const autoNo = el('input', { type: 'checkbox', checked: true });
  const manualNo = UI.input({ placeholder: 'e.g. UEF-INT-SPEC-0001' });

  // Progress indicator
  const progressBox = el('div', { style: 'display:none;margin-top:12px;padding:12px;background:#eff6ff;border-radius:6px' },
    el('div', { class: 'progress-bar', style: 'height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden' },
      el('div', { class: 'progress-fill', style: 'height:100%;background:#1667d9;width:0%;transition:width .3s' })),
    el('div', { class: 'progress-text', style: 'font-size:13px;margin-top:6px;color:#475569' }, 'Uploading...')
  );

  const m = UI.modal('Register Document', el('div', {},
    form,
    el('hr', { class: 'sep' }),
    el('b', {}, 'UEF Document Control'), el('p', { class: 'small muted', style: 'margin:4px 0 8px' }, 'Controlled codes are validated against the Code Registry.'),
    uefForm,
    el('hr', { class: 'sep' }),
    el('label', { class: 'f' }, el('span', {}, 'Numbering'),
      el('div', { class: 'btnrow' },
        el('label', { style: 'display:flex;gap:6px;align-items:center;font-size:13px' }, autoNo, 'Auto-generate from configurable rule'),
        manualNo)),
    el('div', { class: 'small muted mt' }, 'Leave manual blank to generate automatically per project numbering rules.'),
    progressBox
    ), {
    lg: true,
    actions: [
      { label: 'Cancel', onClick: close => close() },
      {
        label: 'Upload & Register', kind: 'primary', onClick: async close => {
          // Validation
          if (!v.title.value || !v.title.value.trim()) { UI.toast('Title is required', 'err'); return; }
          if (!v.prid.value) { UI.toast('Project is required', 'err'); return; }
          if (!v.doc_type_id.value) { UI.toast('Document type is required', 'err'); return; }
          if (!pendingFiles.length) { UI.toast('At least one file is required', 'err'); return; }

          // Show progress
          progressBox.style.display = 'block';
          const fill = progressBox.querySelector('.progress-fill');
          const ptext = progressBox.querySelector('.progress-text');

          try {
            // Step 1: Register document
            fill.style.width = '30%';
            ptext.textContent = 'Step 1/2: Registering document…';
            const body = {};
            for (const [k, node] of Object.entries(v)) body[k] = node.value || undefined;
            body.direction = v.direction.value;
            if (!autoNo.checked && manualNo.value.trim()) body.doc_number = manualNo.value.trim();
            const res = await API.post('/documents', body);
            const docId = res.data.id;
            const docNumber = res.data.doc_number;

            // Step 2: Upload files
            fill.style.width = '60%';
            ptext.textContent = `Step 2/2: Uploading ${pendingFiles.length} file(s)…`;

            // Get the current revision
            const docDetail = await API.get('/documents/' + docId);
            const curRev = docDetail.data.revisions.find(r => r.is_current);
            if (!curRev) throw new Error('No current revision found');

            let uploaded = 0;
            for (const file of pendingFiles) {
              ptext.textContent = `Uploading ${uploaded + 1}/${pendingFiles.length}: ${file.name}…`;
              await API.upload(`/documents/${docId}/revisions/${curRev.id}/versions/multipart`, file, 'Uploaded via registration');
              uploaded++;
              fill.style.width = (60 + (uploaded / pendingFiles.length) * 40) + '%';
            }

            fill.style.width = '100%';
            ptext.textContent = 'Complete!';
            UI.toast(`Registered ${docNumber} with ${uploaded} file(s)`, 'ok');
            close(); if (done) done();
          } catch (e) {
            fill.style.width = '0%';
            progressBox.style.display = 'none';
            UI.toast('Upload failed: ' + e.message, 'err');
          }
        }
      }
    ]
  });
}
window.openRegisterModal = openRegisterModal;

/* ============================================================
   SCAN & IMPORT MODAL
   ============================================================ */
async function openScanImportModal(done) {
  let scanFiles = [];
  const dropZone = el('div', {
    class: 'drop-zone',
    style: 'border:2px dashed #94a3b8;border-radius:8px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc',
    ondragover: e => { e.preventDefault(); dropZone.style.borderColor = '#16a34a'; dropZone.style.background = '#f0fdf4'; },
    ondragleave: e => { dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; },
    ondrop: e => { e.preventDefault(); dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; handleScanFiles(e.dataTransfer.files); },
    onclick: () => scanInput.click()
  },
    el('div', { style: 'font-size:36px;margin-bottom:8px' }, '📷'),
    el('div', { style: 'font-size:15px;font-weight:600;color:#1e293b' }, 'Scan & Import'),
    el('div', { style: 'font-size:13px;color:#64748b;margin-top:4px' }, 'Drag scanned PDF/images here, or click to browse'),
    el('div', { style: 'font-size:12px;color:#94a3b8;margin-top:4px' }, 'Supports: PDF, TIFF, JPEG, PNG — Single or multi-page')
  );

  const scanInput = el('input', {
    type: 'file', multiple: true, style: 'display:none',
    accept: '.pdf,.tif,.tiff,.jpg,.jpeg,.png',
    onchange: () => handleScanFiles(scanInput.files)
  });

  const scanFileList = el('div', { style: 'margin-top:12px' });

  function handleScanFiles(files) {
    for (const f of files) { scanFiles.push(f); }
    renderScanFiles();
  }

  function renderScanFiles() {
    scanFileList.innerHTML = '';
    if (!scanFiles.length) return;
    scanFiles.forEach((f, i) => {
      scanFileList.append(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #e2e8f0;font-size:13px' },
        el('span', { style: 'flex:1' }, `📄 ${f.name}`),
        el('span', { style: 'color:#64748b' }, (f.size / 1024).toFixed(1) + ' KB'),
        el('button', { class: 'btn sm', style: 'color:#dc2626', onclick: () => { scanFiles.splice(i, 1); renderScanFiles(); } }, '✕')
      ));
    });
  }

  const title = el('input', { type: 'text', placeholder: 'Document title' });
  const project = el('input', { type: 'text', placeholder: 'Project PRID (e.g. 0150)' });
  const docType = el('input', { type: 'text', placeholder: 'Document type code (e.g. SPEC)' });
  const dept = el('input', { type: 'text', placeholder: 'Department code (e.g. EN)' });
  const disc = el('input', { type: 'text', placeholder: 'Discipline code (e.g. INT)' });
  const notes = el('textarea', { placeholder: 'Notes about the scanned document…', style: 'min-height:60px' });

  UI.modal('Scan & Import Document', el('div', {},
    dropZone, scanInput, scanFileList,
    el('hr', { class: 'sep' }),
    el('div', { class: 'frm-grid' },
      UI.field('Document Title *', title, true),
      UI.field('Project PRID *', project, true),
      UI.field('Document Type *', docType, true),
      UI.field('Department', dept),
      UI.field('Discipline', disc),
      UI.field('Notes', notes)
    ),
    el('div', { class: 'small muted mt' }, 'Workflow: Scan on your workstation → Save to a folder → Drag files here → Fill metadata → Submit. The system will register each file as a controlled document record.')
  ), {
    lg: true,
    actions: [
      { label: 'Cancel', onClick: c => c() },
      {
        label: 'Import & Register', kind: 'primary', onClick: async c => {
          if (!scanFiles.length) { UI.toast('At least one scanned file is required', 'err'); return; }
          if (!title.value.trim()) { UI.toast('Title is required', 'err'); return; }
          if (!project.value.trim()) { UI.toast('Project is required', 'err'); return; }
          try {
            for (const file of scanFiles) {
              const docRes = await API.post('/documents', {
                title: title.value.trim(),
                direction: 'incoming',
                prid: project.value.trim(),
                doc_type_id: docType.value.trim() || 'SPEC',
                department_code: dept.value.trim() || undefined,
                discipline_code: disc.value.trim() || undefined,
                remarks: notes.value || 'Scanned document imported'
              });
              const docId = docRes.data.id;
              const docDetail = await API.get('/documents/' + docId);
              const curRev = docDetail.data.revisions.find(r => r.is_current);
              if (curRev) {
                await API.upload(`/documents/${docId}/revisions/${curRev.id}/versions/multipart`, file, 'Scanned import');
              }
            }
            UI.toast(`Imported ${scanFiles.length} scanned document(s)`, 'ok');
            c(); if (done) done();
          } catch (e) { UI.toast('Import failed: ' + e.message, 'err'); }
        }
      }
    ]
  });
}
window.openScanImportModal = openScanImportModal;

/* ============================================================
   EMAIL / OUTLOOK IMPORT MODAL
   ============================================================ */
async function openEmailImportModal(done) {
  let emailFiles = [];
  const dropZone = el('div', {
    class: 'drop-zone',
    style: 'border:2px dashed #94a3b8;border-radius:8px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;background:#f8fafc',
    ondragover: e => { e.preventDefault(); dropZone.style.borderColor = '#c07f00'; dropZone.style.background = '#fffbeb'; },
    ondragleave: e => { dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; },
    ondrop: e => { e.preventDefault(); dropZone.style.borderColor = '#94a3b8'; dropZone.style.background = '#f8fafc'; handleEmailFiles(e.dataTransfer.files); },
    onclick: () => emailInput.click()
  },
    el('div', { style: 'font-size:32px;margin-bottom:8px' }, '📧'),
    el('div', { style: 'font-size:14px;color:#475569' }, 'Drop email attachments or .eml/.msg files here'),
    el('div', { style: 'font-size:12px;color:#94a3b8;margin-top:4px' }, 'Or click to browse for files from Outlook')
  );

  const emailInput = el('input', {
    type: 'file', multiple: true, style: 'display:none',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.eml,.msg,.txt,.zip',
    onchange: () => handleEmailFiles(emailInput.files)
  });

  const emailFileList = el('div', { style: 'margin-top:8px' });

  function handleEmailFiles(files) {
    for (const f of files) { emailFiles.push(f); }
    renderEmailFiles();
  }

  function renderEmailFiles() {
    emailFileList.innerHTML = '';
    emailFiles.forEach((f, i) => {
      emailFileList.append(el('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #e2e8f0;font-size:13px' },
        el('span', { style: 'flex:1' }, `📎 ${f.name}`),
        el('span', { style: 'color:#64748b' }, (f.size / 1024).toFixed(1) + ' KB'),
        el('button', { class: 'btn sm', style: 'color:#dc2626', onclick: () => { emailFiles.splice(i, 1); renderEmailFiles(); } }, '✕')
      ));
    });
  }

  const sender = el('input', { type: 'text', placeholder: 'Sender email address' });
  const subject = el('input', { type: 'text', placeholder: 'Email subject' });
  const receivedDate = el('input', { type: 'date' });
  const corrType = el('select', {}, ...['Letter', 'Email', 'Fax', 'Notice', 'Instruction'].map(t => el('option', { value: t }, t)));
  const project = el('input', { type: 'text', placeholder: 'Project PRID' });
  const responseRequired = el('input', { type: 'checkbox' });
  const responseDue = el('input', { type: 'date' });

  UI.modal('Import from Outlook', el('div', {},
    dropZone, emailInput, emailFileList,
    el('hr', { class: 'sep' }),
    el('div', { class: 'frm-grid' },
      UI.field('Sender *', sender, true),
      UI.field('Subject *', subject, true),
      UI.field('Received Date', receivedDate),
      UI.field('Correspondence Type', corrType),
      UI.field('Project PRID', project),
      el('label', { class: 'f' }, el('span', {}, 'Response Required'), responseRequired),
      UI.field('Response Due Date', responseDue)
    ),
    el('div', { class: 'small muted mt' }, 'Workflow: Forward email to idms-inbox@company.com → System extracts attachments → You review and confirm → Register as controlled document. Or drag files here manually.')
  ), {
    lg: true,
    actions: [
      { label: 'Cancel', onClick: c => c() },
      {
        label: 'Import & Register', kind: 'primary', onClick: async c => {
          if (!emailFiles.length) { UI.toast('At least one file is required', 'err'); return; }
          if (!sender.value.trim()) { UI.toast('Sender is required', 'err'); return; }
          if (!subject.value.trim()) { UI.toast('Subject is required', 'err'); return; }
          try {
            // Create correspondence record first
            const corrRes = await API.post('/correspondence', {
              direction: 'incoming',
              subject: subject.value.trim(),
              corr_type: corrType.value,
              sender_name: sender.value.trim(),
              received_date: receivedDate.value || undefined,
              response_required: responseRequired.checked ? 1 : 0,
              response_due_date: responseDue.value || undefined,
              body: 'Imported from Outlook'
            });

            // Upload each attachment as a document
            for (const file of emailFiles) {
              const docRes = await API.post('/documents', {
                title: subject.value.trim() + ' — ' + file.name,
                direction: 'incoming',
                prid: project.value.trim() || '0000',
                doc_type_id: 'COR',
                remarks: `Email from ${sender.value}, Subject: ${subject.value}`
              });
              const docId = docRes.data.id;
              const docDetail = await API.get('/documents/' + docId);
              const curRev = docDetail.data.revisions.find(r => r.is_current);
              if (curRev) {
                await API.upload(`/documents/${docId}/revisions/${curRev.id}/versions/multipart`, file, 'Outlook import');
              }
            }
            UI.toast(`Imported ${emailFiles.length} attachment(s) from Outlook`, 'ok');
            c(); if (done) done();
          } catch (e) { UI.toast('Import failed: ' + e.message, 'err'); }
        }
      }
    ]
  });
}
window.openEmailImportModal = openEmailImportModal;

/* ============================================================
   EXPORT FUNCTIONS
   ============================================================ */
async function exportDocumentRegister() {
  try {
    const res = await API.get('/documents?pageSize=10000');
    const rows = res.data;
    if (!rows.length) { UI.toast('No documents to export', 'err'); return; }
    const headers = ['Document Number', 'Title', 'Type', 'Project', 'Status', 'Revision', 'Discipline', 'Reviewer', 'Received Date'];
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      csvRows.push([
        `"${r.doc_number || ''}"`, `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${r.doc_type_code || ''}"`, `"${r.project_code || ''}"`,
        `"${r.internal_status_code || ''}"`, `"${r.revision_label || ''}"`,
        `"${r.discipline_name || ''}"`, `"${r.reviewer_name || ''}"`,
        `"${r.receipt_date || ''}"`
      ].join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: 'Document_Register_' + new Date().toISOString().slice(0, 10) + '.csv' });
    a.click(); URL.revokeObjectURL(url);
    UI.toast('Document register exported', 'ok');
  } catch (e) { UI.toast('Export failed: ' + e.message, 'err'); }
}

async function exportCSV() {
  await exportDocumentRegister(); // Same as export for now
}

function printRegister() {
  window.print();
}

window.openScanImportModal = openScanImportModal;
window.openEmailImportModal = openEmailImportModal;
window.exportDocumentRegister = exportDocumentRegister;
window.exportCSV = exportCSV;
window.printRegister = printRegister;
