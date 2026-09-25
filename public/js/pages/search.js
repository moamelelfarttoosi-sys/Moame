/* Advanced Search workbench: Filter / Columns / Order / My Templates */
window.Pages = window.Pages || {};
Pages.search = {
  title: 'Advanced Search',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Advanced Search';
    const [colsRes, fieldsRes] = await Promise.all([API.get('/search/columns'), Promise.resolve(null)]);
    const COLUMNS = colsRes.data;
    const FIELD_OPTIONS = [
      ['doc_number', 'Document Number'], ['title', 'Title'], ['revision', 'Revision'],
      ['doc_type', 'Document Type'], ['project', 'Project'], ['contract', 'Contract'],
      ['discipline', 'Discipline'], ['organization', 'Organization'], ['customer', 'Customer'],
      ['contractor', 'Contractor'], ['internal_status', 'Internal Status'], ['external_status', 'External Status'],
      ['purpose', 'Purpose of Issue'], ['receipt_date', 'Receipt Date'], ['accept_date', 'Accept Date'],
      ['document_date', 'Document Date'], ['due_date', 'Due Date'], ['registered_at', 'Registered At'],
      ['endorser', 'Endorser'], ['dcc', 'DCC'], ['reviewer', 'Reviewer'], ['approver', 'Approver'],
      ['transmittal', 'Transmittal Ref'], ['correspondence_ref', 'Correspondence Ref'],
      ['confidentiality', 'Confidentiality'], ['archive_status', 'Archive Status'],
      ['register_type', 'Register'], ['prid', 'PRID'], ['so_po', 'SO/PO'],
      ['class', 'Class'], ['department_code', 'Department Code'], ['section_code', 'Section Code'],
      ['originator_code', 'Originator Code'], ['numbering_scheme', 'Numbering Scheme']
    ];
    const OPS = [['eq', '='], ['neq', '≠'], ['contains', 'contains'], ['starts', 'starts with'],
      ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['between', 'between']];

    const state = { filters: [], logic: 'AND', sort: [], columns: null, page: 1, pageSize: 25 };
    const tabBar = el('div', { class: 'tabs' });
    const pane = el('div');
    const resultsBox = el('div');

    /* ---------- Filter tab ---------- */
    function filterPane() {
      const wrap = el('div');
      const rowsBox = el('div');

      function addRow(f = { field: 'doc_number', op: 'contains', value: '' }) {
        const fsel = UI.select(FIELD_OPTIONS); fsel.value = f.field;
        const osel = UI.select(OPS); osel.value = f.op;
        const v1 = UI.input({ value: f.value ?? '' }); v1.type = /date|_at$/.test(f.field) ? 'date' : 'text';
        const del = el('button', { class: 'btn sm danger', onclick: () => { row.remove(); sync(); } }, '✕');
        const row = el('div', { class: 'filter-row' }, fsel, osel, el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px' }, v1), del);
        fsel.addEventListener('change', () => { v1.type = /date|_at$/.test(fsel.value) ? 'date' : 'text'; });
        rowsBox.append(row);
        sync();
        function sync() {
          state.filters = [...rowsBox.children].map(r => ({
            field: r.children[0].value, op: r.children[1].value, value: r.children[2].children[0].value
          }));
        }
        [fsel, osel].forEach(s => s.addEventListener('change', sync));
        v1.addEventListener('input', sync);
      }

      const andOr = el('div', { class: 'chips mb' },
        el('button', { class: 'chip on', onclick: e => { state.logic = 'AND'; mark(e.target); } }, 'Match ALL (AND)'),
        el('button', { class: 'chip', onclick: e => { state.logic = 'OR'; mark(e.target); } }, 'Match ANY (OR)'));
      function mark(t) { [...andOr.children].forEach(c => c.classList.remove('on')); t.classList.add('on'); }

      wrap.append(andOr, rowsBox,
        el('div', { class: 'btnrow' },
          el('button', { class: 'btn sm', onclick: () => addRow() }, '+ Add filter')));
      // seed rows from a loaded template, otherwise start with one empty row
      const seed = (state.filters || []).filter(f => f.field);
      if (seed.length) seed.forEach(f => addRow({ field: f.field, op: f.op, value: f.value }));
      else addRow();
      return wrap;
    }

    /* ---------- Columns tab ---------- */
    function columnsPane() {
      const box = el('div', { class: 'chips' });
      for (const c of COLUMNS) {
        const chip = el('button', {
          class: 'chip' + (state.columns ? (state.columns.includes(c.key) ? ' on' : '') : ' on'),
          onclick: () => {
            state.columns = state.columns || COLUMNS.map(x => x.key);
            const i = state.columns.indexOf(c.key);
            if (i >= 0) state.columns.splice(i, 1); else state.columns.push(c.key);
            chip.classList.toggle('on');
            run();
          }
        }, c.label);
        box.append(chip);
      }
      const resetBtn = el('button', { class: 'btn sm mt', onclick: () => { state.columns = null; renderPanes(); run(); } }, 'Reset to default columns');
      return el('div', {}, el('p', { class: 'small muted' }, 'Select which result columns are displayed.'), box, resetBtn);
    }

    /* ---------- Order tab ---------- */
    function orderPane() {
      const box = el('div');
      function redraw() {
        box.innerHTML = '';
        state.sort.forEach((s, i) => {
          const fsel = UI.select([['', '— field —'], ...FIELD_OPTIONS]); fsel.value = s.field || '';
          const dirsel = UI.select([['asc', 'Ascending'], ['desc', 'Descending']]); dirsel.value = s.dir || 'asc';
          const del = el('button', { class: 'btn sm danger', onclick: () => { state.sort.splice(i, 1); redraw(); run(); } }, '✕');
          [fsel, dirsel].forEach(sel => sel.addEventListener('change', () => { sync(); run(); }));
          box.append(el('div', { class: 'filter-row' },
            el('span', { class: 'muted small', style: 'padding-left:4px' }, `Level ${i + 1}`), fsel, dirsel, del));
        });
      }
      function sync() {
        state.sort = [...box.querySelectorAll('.filter-row')].map(r => ({ field: r.children[1].value, dir: r.children[2].value })).filter(s => s.field);
      }
      redraw();
      return el('div', {},
        el('p', { class: 'small muted' }, 'Multi-level ordering. Level 1 sorts first.'),
        box, el('button', { class: 'btn sm', onclick: () => { state.sort.push({ field: 'doc_number', dir: 'asc' }); redraw(); run(); } }, '+ Add sort level'));
    }

    /* ---------- Templates tab ---------- */
    async function templatesPane() {
      const res = await API.get('/search/templates');
      const nameIn = UI.input({ placeholder: 'Template name…' });
      const shared = el('input', { type: 'checkbox' });
      const list = el('div');
      for (const t of res.data) {
        list.append(el('div', { class: 'btnrow', style: 'margin-bottom:6px' },
          el('span', { style: 'flex:1' }, el('b', {}, t.name),
            t.is_shared_template ? el('span', { class: 'tag' }, 'shared template') : null),
            el('button', { class: 'btn sm primary', onclick: () => applyDef(JSON.parse(t.definition)) }, 'Load'),
            el('button', { class: 'btn sm danger', onclick: async () => { try { await API.del('/search/templates/' + t.id); renderPanes(); } catch (e) { UI.toast(e.message, 'err'); } } }, 'Delete')));
      }
      return el('div', {},
        el('div', { class: 'btnrow mb' }, nameIn, el('label', { class: 'small', style: 'display:flex;gap:5px;align-items:center' }, shared, 'Share as template'),
          el('button', {
            class: 'btn primary sm', onclick: async () => {
              try {
                await API.post('/search/templates', {
                  name: nameIn.value.trim(),
                  definition: { filters: currentFilters(), logic: state.logic, sort: state.sort, columns: state.columns },
                  is_shared_template: shared.checked
                });
                UI.toast('Saved', 'ok'); renderPanes();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }, 'Save current search')),
        list.length ? list : el('p', { class: 'muted small' }, 'No saved searches yet.'));
    }

    function currentFilters() {
      const out = [];
      [...document.querySelectorAll('.filter-row')].forEach(r => {
        if (r.parentElement === null) return;
        const f = r.children[0], o = r.children[1], vv = r.children[2] && r.children[2].children && r.children[2].children[0];
        if (f && o && vv) out.push({ field: f.value, op: o.value, value: vv.value });
      });
      // fall back to state when filter pane not mounted
      return out.filter(x => x.field).length ? out.filter(x => x.field) : state.filters.filter(f => f.field && String(f.value).length);
    }

    function applyDef(def) {
      state.logic = def.logic || 'AND';
      state.sort = def.sort || [];
      state.columns = def.columns || null;
      state.filters = def.filters || [];
      renderPanes();
      run();
    }

    /* ---------- layout & run ---------- */
    let panes = {};
    function renderPanes() {
      pane.innerHTML = '';
      panes = { filter: filterPane(), columns: columnsPane(), order: orderPane() };
      tabBar.innerHTML = '';
      const defs = [
        ['filter', 'Filter'], ['columns', 'Columns'], ['order', 'Order'], ['templates', 'My Templates']
      ];
      defs.forEach(([key, label]) => {
        const btn = el('button', { onclick: () => select(key) }, label);
        btn.dataset.tab = key;
        tabBar.append(btn);
      });
      select('filter');
      async function select(key) {
        [...tabBar.children].forEach(b => b.classList.toggle('active', b.dataset.tab === key));
        pane.innerHTML = '';
        if (key === 'templates') pane.append(await templatesPane());
        else pane.append(panes[key]);
      }
    }

    async function run() {
      // capture live filter values from DOM
      const liveFilters = [];
      document.querySelectorAll('.filter-row').forEach(r => {
        const f = r.children[0] && r.children[0].tagName === 'SELECT' ? r.children[0].value : null;
        const op = r.children[1] ? r.children[1].value : null;
        const valEl = r.querySelector('input');
        if (f && op && valEl) liveFilters.push({ field: f, op, value: valEl.value });
      });
      const payload = {
        filters: liveFilters.length ? liveFilters : state.filters,
        logic: state.logic,
        sort: state.sort,
        columns: state.columns || undefined,
        page: state.page,
        pageSize: state.pageSize
      };
      try {
        const res = await API.post('/search', payload);
        resultsBox.innerHTML = '';
        const colDefs = res.meta.columns;
        resultsBox.append(el('div', { class: 'card' },
          el('div', { class: 'bd' },
            UI.table({
              columns: colDefs.map(cd => ({
                key: cd.key, label: cd.label,
                render: r => cd.key === 'doc_number'
                  ? el('a', { href: '#/documents/' + r.id, class: 'mono' }, r.cells[cd.key] ?? '')
                  : (r.cells[cd.key] ?? '')
              })),
              rows: res.data,
              emptyText: 'No documents match the criteria'
            }),
            el('div', { class: 'btnrow mt' },
              el('span', { class: 'muted small', style: 'flex:1' }, `${res.meta.total} result${res.meta.total === 1 ? '' : 's'} · page ${res.meta.page}/${Math.max(1, Math.ceil(res.meta.total / res.meta.pageSize))}`),
              API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exportAs(payload, 'csv') }, 'Export CSV') : null,
              API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exportAs(payload, 'excel') }, 'Export Excel') : null,
              API.can('report.export') ? el('button', { class: 'btn sm', onclick: () => exportAs(payload, 'pdf') }, 'Export PDF') : null)),
          el('div', { style: 'padding:0 16px 12px' },
            UI.pager({ page: res.meta.page, pageSize: res.meta.pageSize, total: res.meta.total, onChange: p => { state.page = p; run(); } }))));
      } catch (e) { UI.toast(e.message, 'err'); }
    }

    async function exportAs(base, format) {
      base.format = format;
      try {
        const res = await API.post('/search/export', base);
        UI.downloadFile(res.data.download);
        UI.toast(`Export ready (${res.data.rows} rows)`, 'ok');
      } catch (e) { UI.toast(e.message, 'err'); }
    }

    root.append(tabBar, pane, resultsBox);
    renderPanes();
    await run();
  }
};
