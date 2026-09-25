/* UEF Document Control pages: registers, allocations, code registry, DDM, corrections */
window.Pages = window.Pages || {};
window.UEF = window.UEF || {};
const UEF = window.UEF;

UEF.codeOptions = async function (set) {
  const r = await API.get('/codes/' + set);
  return [['', '—'], ...r.data.map(c => [c.code, `${c.code} — ${c.description}`])];
};

/* ================= REGISTERS (TDR / MDR / VDR / SOP) ================= */
Pages.uefRegisters = {
  async render(root, params, query) {
    const type = (query.type || 'TDR').toUpperCase();
    const labels = { TDR: 'Technical Document Register', MDR: 'Management Document Register', VDR: 'Vendor Document Register', SOP: 'SOP & Corporate Master Register' };
    document.querySelector('.topbar .title').textContent = labels[type] || type;
    const box = el('div');
    const tabs = el('div', { class: 'tabs' }, ['TDR', 'MDR', 'VDR', 'SOP'].map(t =>
      el('button', { class: t === type ? 'active' : '', onclick: () => { location.hash = '#/registers?type=' + t; } }, t)));

    const search = UI.input({ placeholder: 'Search number or title…', onkeydown: e => { if (e.key === 'Enter') load(); } });
    root.append(tabs, el('div', { class: 'btnrow mb' }, search,
      el('button', { class: 'btn', onclick: () => load() }, 'Search'),
      el('a', { class: 'btn primary', href: '#/documents' }, '+ Register Document')), box);

    const COLS = {
      TDR: [['s_n', 'S/N'], ['typical', 'Typical'], ['planned_revision', 'Planned Rev'], ['approval_code', 'Approval Code'], ['date_submitted', 'Submitted'], ['date_approved', 'Approved'], ['transmittal_ref', 'Transmittal'], ['sheets', 'Sheets']],
      MDR: [['deliverable_category', 'Category'], ['planned_revision', 'Planned Rev'], ['approval_code', 'Approval Code'], ['date_submitted', 'Submitted'], ['date_approved', 'Approved'], ['transmittal_ref', 'Transmittal']],
      VDR: [['vendor_doc_number', "Vendor's Doc No"], ['vendor_name', 'Vendor'], ['po_number', 'PO'], ['mr_number', 'MR'], ['system_area', 'System/Area'], ['mrb_included', 'MRB', true], ['approval_code', 'Approval Code'], ['date_submitted', 'Submitted']],
      SOP: [['section_code', 'Section'], ['owner_name', 'Owner'], ['issue_date', 'Issue Date'], ['approving_order', 'Approving Order'], ['review_interval_months', 'Review Interval'], ['next_review_due', 'Next Review'], ['days_to_review', 'Days to Review']]
    };

    async function load() {
      const qp = new URLSearchParams({ pageSize: 100 });
      if (search.value.trim()) qp.set('search', search.value.trim());
      const res = await API.get('/registers/' + type + '?' + qp.toString());
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'doc_number', label: 'Document Number', render: r => el('a', { href: '#/documents/' + r.id, class: 'mono' }, r.doc_number) },
          { key: 'title', label: 'Title' },
          { key: 'current_revision', label: 'Rev' },
          { key: 'status_code', label: 'Status', render: r => UI.badge(r.status_code, '#1667d9') },
          { key: 'prid', label: 'PRID' },
          { key: 'so_po', label: 'SO/PO' },
          { key: 'class_code', label: 'Class' },
          ...COLS[type].map(([k, l, bool]) => ({
            key: k, label: l,
            render: r => bool ? (r[k] ? 'Yes' : 'No')
              : (k.includes('date') || k.includes('_due')) ? UI.fmtDate(r[k])
              : (r[k] ?? '')
          }))
        ],
        rows: res.data,
        onRow: r => { location.hash = '#/documents/' + r.id; }
      }), UI.pager({ ...res.meta, onChange: () => load() }))));
    }
    await load();
  }
};

/* ================= NUMBER ALLOCATION ================= */
Pages.uefAllocations = {
  title: 'Number Allocation',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Document Number Allocation';
    const box = el('div');
    root.append(el('div', { class: 'btnrow mb' },
      el('button', { class: 'btn primary', onclick: newRequest }, '+ New Allocation Request'),
      el('button', { class: 'btn', onclick: gapReport }, 'Gap Check Report')), box);

    async function load() {
      const res = await API.get('/allocations?pageSize=100');
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'request_number', label: 'Request', render: r => el('b', { class: 'mono' }, r.request_number) },
          { key: 'proposed_title', label: 'Proposed Title' },
          { key: 'scheme', label: 'Scheme', render: r => UI.badge(r.scheme || '—', r.scheme === 'CORPORATE' ? '#7c3aed' : '#1667d9') },
          { key: 'generated_number', label: 'Generated Number', render: r => r.generated_number ? el('b', { class: 'mono' }, r.generated_number) : '—' },
          { key: 'decision', label: 'Decision', render: r => UI.badge(r.decision, { pending: '#c07f00', allocated: '#1667d9', issued: '#16a34a', cancelled: '#94a3b8', rejected: '#dc2626' }[r.decision]) },
          { key: 'allocation_date', label: 'Allocated', render: r => UI.fmtDate(r.allocation_date) },
          { key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
            r.decision === 'pending' ? el('button', { class: 'btn sm primary', onclick: () => allocate(r) }, 'Allocate') : null,
            ['pending', 'allocated'].includes(r.decision) ? el('button', { class: 'btn sm danger', onclick: () => cancelReq(r) }, 'Cancel') : null) }
        ],
        rows: res.data
      }))));
    }

    async function newRequest() {
      const [deps, discs, types, users, projects] = await Promise.all([
        UEF.codeOptions('DEPARTMENT'), UEF.codeOptions('DISCIPLINE'), UEF.codeOptions('DOCTYPE'),
        API.get('/lookups/users'), API.get('/codes/PROJECT')]);
      const projOpts = [['', '— Select Project —'], ...projects.data.filter(c => c.lifecycle === 'active').map(c => [c.code, `${c.code} — ${c.description}`])];
      const scheme = UI.select([['PROJECT', 'Project — UEF-PRID-SS-CCC-DDD-EEEE'], ['CORPORATE', 'Corporate — UEF-DEP-SEC-DDD-EEEE']]);
      const title = UI.input();
      const dept = UI.select(await deps);
      const section = UI.select(await UEF.codeOptions('SECTION'));
      const pridSel = UI.select(projOpts);
      const pridManual = UI.input({ placeholder: 'Manual PRID (e.g. 3120)' });
      const ss = UI.input({ placeholder: 'e.g. 01' });
      const disc = UI.select(await discs);
      const docType = UI.select(await types);
      const soPo = UI.input({ placeholder: 'SO / PO reference' });
      const owner = UI.select([['', '—'], ...users.data.map(u => [u.id, u.full_name])]);
      const reqDept = UI.select(deps);

      const corpFields = el('div', { class: 'frm-grid' }, UI.field('Department *', dept), UI.field('Section *', section));
      const projFields = el('div', { class: 'frm-grid' },
        UI.field('Project (from register) *', pridSel),
        el('div', { class: 'small muted', style: 'margin:-4px 0 8px 160px' }, 'Or enter manual PRID below if not in register'),
        UI.field('Manual PRID', pridManual),
        UI.field('SS / Service Order *', ss), UI.field('Discipline *', disc), UI.field('SO / PO', soPo));
      const sync = () => { corpFields.style.display = scheme.value === 'CORPORATE' ? '' : 'none'; projFields.style.display = scheme.value === 'PROJECT' ? '' : 'none'; };
      scheme.addEventListener('change', sync); sync();

      UI.modal('New Number Allocation Request', el('div', {},
        el('div', { class: 'frm-grid' },
          UI.field('Numbering scheme *', scheme), UI.field('Proposed title *', title, true),
          UI.field('Requesting department', reqDept), UI.field('Document owner', owner),
          UI.field('Document type *', docType)),
        corpFields, projFields), {
        lg: true,
        actions: [{ label: 'Cancel', onClick: c => c() }, {
          label: 'Create request', kind: 'primary', onClick: async close => {
            try {
              const body = { scheme: scheme.value, proposed_title: title.value, requesting_department: reqDept.value || undefined, owner_user_id: owner.value || undefined, doc_type: docType.value };
              if (scheme.value === 'CORPORATE') { body.department = dept.value; body.section = section.value; }
              else {
                body.prid = pridSel.value || pridManual.value || undefined;
                body.ss = ss.value; body.discipline = disc.value; body.so_po = soPo.value || undefined;
              }
              await API.post('/allocations', body);
              UI.toast('Request created', 'ok'); close(); load();
            } catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }

    function allocate(r) {
      Promise.all([UEF.codeOptions('DEPARTMENT'), UEF.codeOptions('SECTION')]).then(([deps, secs]) => {
        const scheme = UI.select([['PROJECT'], ['CORPORATE']]); scheme.value = r.scheme || 'PROJECT';
        const dept = UI.select(deps); if (r.department) dept.value = r.department;
        const section = UI.select(secs); if (r.section) section.value = r.section;
        const prid = UI.input({ value: r.prid || '' }); const ss = UI.input({ value: r.ss || r.so_po || '' });
        const corp = el('div', { class: 'frm-grid' }, UI.field('Department *', dept), UI.field('Section *', section));
        const proj = el('div', { class: 'frm-grid' }, UI.field('PRID', prid), UI.field('SS', ss));
        const sync = () => { corp.style.display = scheme.value === 'CORPORATE' ? '' : 'none'; proj.style.display = scheme.value === 'PROJECT' ? '' : 'none'; };
        scheme.addEventListener('change', sync); sync();
        UI.modal(`Allocate number — ${r.request_number}`, el('div', {},
          el('p', { class: 'muted small' }, 'Validates codes, checks the series, generates and locks the next sequence.'),
          UI.field('Scheme *', scheme), corp, proj), {
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Allocate & lock', kind: 'primary', onClick: async close => {
              try {
                const res = await API.post(`/allocations/${r.id}/allocate`, {
                  scheme: scheme.value, department: dept.value || undefined, section: section.value || undefined,
                  prid: prid.value || undefined, ss: ss.value || undefined
                });
                UI.toast(`Allocated: ${res.data.generated_number}`, 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      });
    }

    function cancelReq(r) {
      const reason = UI.input();
      UI.modal('Cancel allocation request', el('div', {}, UI.field('Reason *', reason, true),
        el('p', { class: 'small muted' }, 'If a number was already generated it remains locked forever — it is never reused.')), {
        actions: [{ label: 'Keep', onClick: c => c() }, {
          label: 'Cancel request', kind: 'danger', onClick: async close => {
            try { await API.post(`/allocations/${r.id}/cancel`, { reason: reason.value }); UI.toast('Cancelled', 'ok'); close(); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }

    async function gapReport() {
      const res = await API.get('/allocations/gap-check');
      UI.modal('Number Gap Check Report', el('div', {}, res.data.map(s => el('div', { class: 'card mb', style: 'padding:12px' },
        el('div', {}, el('b', { class: 'mono' }, s.series_key), ' ', UI.badge(s.scheme, s.scheme === 'CORPORATE' ? '#7c3aed' : '#1667d9'),
          el('span', { class: 'tag' }, `last seq: ${s.last_seq}`), el('span', { class: 'tag' }, `allocated: ${s.allocated_count}`),
          s.healthy ? UI.badge('HEALTHY', '#16a34a') : UI.badge('GAPS', '#dc2626')),
        s.missing_gaps.length ? el('ul', { class: 'small' }, s.missing_gaps.map(g => el('li', {}, `Sequence ${g.sequence}: ${g.note}`))) : null,
        s.unused_locked.length ? el('ul', { class: 'small muted' }, s.unused_locked.map(u => el('li', {}, `${u.number} — ${u.note}`))) : null))), { lg: true });
    }
    await load();
  }
};

/* ================= CODE REGISTRY ================= */
Pages.uefCodes = {
  title: 'Controlled Code Registry',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Controlled Code Registry';
    const SETS = ['DEPARTMENT', 'SECTION', 'DISCIPLINE', 'DOCTYPE', 'ORIGINATOR', 'CLASS', 'LANGUAGE', 'PROJECT'];
    const sel = UI.select(SETS.map(s => [s, s]));
    const box = el('div');
    sel.addEventListener('change', load);
    root.append(el('div', { class: 'btnrow mb' }, sel,
      el('button', { class: 'btn primary', onclick: addCode }, '+ Create Code'),
      el('span', { class: 'small muted' }, 'Lifecycle: active → inactive → retired. Codes are never deleted.')), box);

    async function load() {
      const res = await API.get('/codes/admin/codes?code_set=' + sel.value);
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'code', label: 'Code', render: r => el('b', { class: 'mono' }, r.code) },
          { key: 'description', label: 'Description' },
          { key: 'lifecycle', label: 'Lifecycle', render: r => UI.badge(r.lifecycle, { active: '#16a34a', inactive: '#c07f00', retired: '#94a3b8' }[r.lifecycle]) },
          { key: 'updated_by_name', label: 'Updated by' },
          { key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
            el('button', { class: 'btn sm', onclick: () => editCode(r) }, 'Edit'),
            r.lifecycle === 'active' ? el('button', { class: 'btn sm', onclick: () => life(r, 'inactive') }, 'Deactivate') : null,
            r.lifecycle === 'inactive' ? el('button', { class: 'btn sm good', onclick: () => life(r, 'active') }, 'Reactivate') : null,
            r.lifecycle === 'inactive' ? el('button', { class: 'btn sm danger', onclick: () => life(r, 'retired') }, 'Retire') : null) }
        ],
        rows: res.data
      }))));

      function editCode(r) {
        const d = UI.input({ value: r.description });
        UI.modal(`${r.code_set}: ${r.code}`, UI.field('Description', d), {
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Save', kind: 'primary', onClick: async close => {
              try { await API.put('/codes/admin/codes/' + r.id, { description: d.value }); UI.toast('Saved', 'ok'); close(); load(); }
              catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      }
      async function life(r, lifecycle) {
        try { await API.put('/codes/admin/codes/' + r.id, { lifecycle }); UI.toast('Lifecycle updated', 'ok'); load(); }
        catch (e) { UI.toast(e.message, 'err'); }
      }
    }
    async function addCode() {
      const code = UI.input(); const desc = UI.input();
      UI.modal(`Create ${sel.value} code`, el('div', { class: 'frm-grid' },
        UI.field('Code *', code, true), UI.field('Description *', desc, true)), {
        actions: [{ label: 'Cancel', onClick: c => c() }, {
          label: 'Create', kind: 'primary', onClick: async close => {
            try { await API.post('/codes/admin/codes', { code_set: sel.value, code: code.value, description: desc.value }); UI.toast('Created', 'ok'); close(); load(); }
            catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }
    await load();
  }
};

/* ================= DDM ================= */
Pages.uefDdm = {
  title: 'Document Distribution Matrix',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Document Distribution Matrix (DDM)';
    const box = el('div');
    root.append(el('div', { class: 'btnrow mb' }, el('button', { class: 'btn primary', onclick: addRule }, '+ New DDM Rule')), box);

    async function load() {
      const [rules, users] = await Promise.all([API.get('/ddm'), API.get('/lookups/users')]);
      const uname = id => (users.data.find(u => u.id === id) || {}).full_name || '—';
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'discipline_code', label: 'Discipline' },
          { key: 'doc_type_code', label: 'Doc Type' },
          { key: 'class_code', label: 'Class' },
          { key: 'originator_code', label: 'Originator' },
          { key: 'reviewer1_name', label: 'Reviewer 1' },
          { key: 'endorser_name', label: 'Endorser' },
          { key: 'approver_name', label: 'Approver', render: r => r.approver_name || el('span', { class: 'tag' }, 'role:' + r.approver_role_code) },
          { key: 'business_process_level', label: 'Level' },
          { key: 'is_active', label: 'Active', render: r => r.is_active ? '✓' : '✗' },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm', onclick: () => editRule(r, users.data) }, 'Edit') }
        ],
        rows: rules.data
      })), el('p', { class: 'small muted', style: 'padding:0 16px 12px' }, 'When a document enters review, the DDM automatically determines Reviewer(s), Endorser, Approver (mandatory — cannot be bypassed) and copy recipients.')));

      function userSel(val) {
        const s = UI.select([['', '—'], ...users.data.map(u => [u.id, u.full_name])]);
        if (val) s.value = String(val);
        return s;
      }
      function editRule(r) {
        const disc = UI.input({ value: r.discipline_code }); const dt = UI.input({ value: r.doc_type_code });
        const cls = UI.input({ value: r.class_code }); const org = UI.input({ value: r.originator_code });
        const rv1 = userSel(r.reviewer1_user_id); const rv2 = userSel(r.reviewer2_user_id);
        const en = userSel(r.endorser_user_id); const ap = userSel(r.approver_user_id);
        const level = UI.input({ value: r.business_process_level || '' });
        UI.modal(r.id ? `Edit DDM rule #${r.id}` : 'New DDM rule', el('div', { class: 'frm-grid' },
          UI.field('Discipline code (* = any)', disc), UI.field('Document type code (* = any)', dt),
          UI.field('Class code (* = any)', cls), UI.field('Originator code (* = any)', org),
          UI.field('Reviewer 1', rv1), UI.field('Reviewer 2', rv2),
          UI.field('Endorser', en), UI.field('Approver (mandatory in workflow)', ap),
          UI.field('Business process level', level)), {
          lg: true,
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Save', kind: 'primary', onClick: async close => {
              const body = {
                discipline_code: disc.value || '*', doc_type_code: dt.value || '*', class_code: cls.value || '*', originator_code: org.value || '*',
                reviewer1_user_id: rv1.value || null, reviewer2_user_id: rv2.value || null,
                endorser_user_id: en.value || null, approver_user_id: ap.value || null,
                business_process_level: level.value || null
              };
              try {
                if (r.id) await API.put('/ddm/' + r.id, body); else await API.post('/ddm', body);
                UI.toast('Saved', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      }
      async function addRule() { editRule({}); }
    }
    await load();
  }
};

/* ================= CORRECTION LOG ================= */
Pages.uefCorrections = {
  title: 'Correction / Change Log',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Correction & Change Log';
    const box = el('div');
    root.append(el('div', { class: 'btnrow mb' },
      API.can('correction.record') ? el('button', { class: 'btn primary', onclick: newCorrection }, '+ Record Correction') : null,
      el('span', { class: 'small muted' }, 'Permanent governance log — records are immutable.')), box);

    async function load() {
      const res = await API.get('/corrections?pageSize=100');
      box.innerHTML = '';
      box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'correction_number', label: 'Correction', render: r => el('b', { class: 'mono' }, r.correction_number) },
          { key: 'register', label: 'Register', render: r => UI.badge(r.register, '#334155') },
          { key: 'record_id', label: 'Record' },
          { key: 'field_name', label: 'Field' },
          { key: 'previous_value', label: 'Previous', render: r => el('code', { class: 'mono small' }, r.previous_value ?? '—') },
          { key: 'corrected_value', label: 'Corrected', render: r => el('code', { class: 'mono small' }, r.corrected_value ?? '—') },
          { key: 'reason', label: 'Reason' },
          { key: 'user_name', label: 'By' },
          { key: 'authorizer_name', label: 'Authorized by' },
          { key: 'corrected_at', label: 'At', render: r => UI.fmtDT(r.corrected_at) }
        ],
        rows: res.data
      }))));
    }

    function newCorrection() {
      const reg = UI.select([['DOCUMENTS', 'DCR — Documents'], ['CORRESPONDENCE', 'Correspondence'], ['TDR', 'TDR'], ['MDR', 'MDR'], ['VDR', 'VDR'], ['SOP', 'SOP']]);
      const rid = UI.input({ type: 'number', placeholder: 'Record id' });
      const field = UI.input({ placeholder: 'e.g. pages_sheets, title, clause' });
      const newVal = UI.input();
      const reason = UI.textarea();
      const authorizer = UI.input({ type: 'number', placeholder: 'Authorizing user id (optional)' });
      UI.modal('Record controlled correction', el('div', {},
        el('div', { class: 'frm-grid' },
          UI.field('Register *', reg), UI.field('Record ID *', rid, true),
          UI.field('Field *', field, true), UI.field('Corrected value', newVal),
          UI.field('Authorizing user', authorizer)),
        el('label', { class: 'f' }, el('span', { class: 'req' }, 'Reason *'), reason)), {
        lg: true,
        actions: [{ label: 'Cancel', onClick: c => c() }, {
          label: 'Record correction', kind: 'primary', onClick: async close => {
            try {
              const res = await API.post('/corrections', {
                register: reg.value, record_id: Number(rid.value), field_name: field.value.trim(),
                corrected_value: newVal.value, reason: reason.value,
                authorization_by: authorizer.value ? Number(authorizer.value) : undefined
              });
              UI.toast(`Recorded ${res.data.correction_number}`, 'ok'); close(); load();
            } catch (e) { UI.toast(e.message, 'err'); }
          }
        }]
      });
    }
    await load();
  }
};

/* ================= PROJECT REGISTER ================= */
Pages.projectRegister = {
  title: 'Master Project Register',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Master Project Register';
    const box = el('div');
    const search = UI.input({ placeholder: 'Search PRID or project name…', onkeydown: e => { if (e.key === 'Enter') load(); } });
    const phaseFilter = UI.select([
      ['', 'All Phases'],
      ['CORP', '0000–0090 Corporate & Business Development'],
      ['EXPL', '0100–0290 Exploration & Seismic'],
      ['DRIL', '0300–0490 Drilling & Appraisal'],
      ['DEV',  '0500–0690 Field Development & Facilities'],
      ['INFRA','0700–0990 Gathering, Pipelines & Offshore'],
      ['LNG',  '1000–1190 LNG, Gas & Refinery'],
      ['ENG',  '1200–1390 Engineering & Construction'],
      ['COMM', '1400–1690 Completion, Commissioning & Startup'],
      ['OPS',  '1700–1990 Operations, Brownfield & HSE'],
      ['RET',  '2000–2090 Asset Retirement'],
      ['MAN',  '4210–4300 Mansuriya Gas Field']
    ]);
    phaseFilter.addEventListener('change', load);
    root.append(el('div', { class: 'btnrow mb' }, search, phaseFilter,
      el('button', { class: 'btn', onclick: () => load() }, 'Search')), box);

    const PHASE_RANGES = {
      CORP: [0, 99], EXPL: [100, 299], DRIL: [300, 499], DEV: [500, 699],
      INFRA: [700, 999], LNG: [1000, 1199], ENG: [1200, 1399],
      COMM: [1400, 1699], OPS: [1700, 1999], RET: [2000, 2099], MAN: [4210, 4399]
    };

    async function load() {
      const res = await API.get('/codes/PROJECT');
      let rows = res.data;
      const q = search.value.trim().toLowerCase();
      if (q) rows = rows.filter(r => r.code.includes(q) || r.description.toLowerCase().includes(q));
      const phase = phaseFilter.value;
      if (phase && PHASE_RANGES[phase]) {
        const [lo, hi] = PHASE_RANGES[phase];
        rows = rows.filter(r => { const n = Number(r.code); return n >= lo && n <= hi; });
      }
      box.innerHTML = '';
      box.append(el('div', { class: 'card' },
        el('div', { class: 'bd' },
          el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' },
            el('b', {}, `${rows.length} projects registered`),
            el('span', { class: 'small muted' }, 'Lifecycle: active → inactive → retired')),
          UI.table({
            columns: [
              { key: 'code', label: 'PRID', render: r => el('b', { class: 'mono' }, r.code) },
              { key: 'description', label: 'Project Name' },
              { key: 'lifecycle', label: 'Status', render: r => UI.badge(r.lifecycle, { active: '#16a34a', inactive: '#c07f00', retired: '#94a3b8' }[r.lifecycle]) },
              { key: 'sort_order', label: '#' }
            ],
            rows: rows
          }))));
    }
    await load();
  }
};
