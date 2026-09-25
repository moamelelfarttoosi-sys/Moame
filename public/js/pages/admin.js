/* Administration console */
window.Pages = window.Pages || {};
Pages.admin = {
  title: 'Administration',
  async render(root, params, query) {
    let tab = query.tab || 'users';
    document.querySelector('.topbar .title').textContent = 'Administration & Configuration';
    const pane = el('div');
    const TABS = [
      ['users', 'Users'], ['roles', 'Roles & Permissions'], ['taxonomy', 'Master Data'],
      ['statuses', 'Statuses & Transitions'], ['numbering', 'Numbering Rules'], ['workflows', 'Workflow Templates'],
      ['notifications', 'Notification Rules'], ['sla', 'SLA Rules'], ['archive', 'Archive'],
      ['config', 'System Settings']
    ];
    const bar = el('div', { class: 'tabs' }, TABS.map(([k, label]) =>
      el('button', { class: k === tab ? 'active' : '', onclick: () => { tab = k; renderTab(); syncBar(); } }, label)));
    function syncBar() {
      [...bar.children].forEach((b, i) => b.classList.toggle('active', TABS[i][0] === tab));
    }

    async function renderTab() {
      pane.innerHTML = '';
      if (!API.can('admin.manage')) { pane.append(el('div', { class: 'card' }, el('div', { class: 'bd empty' }, 'Administrator permission required.'))); return; }
      ({ users: tUsers, roles: tRoles, taxonomy: tTaxonomy, statuses: tStatuses, numbering: tNumbering,
        workflows: tWorkflows, notifications: tNotifications, sla: tSla, archive: tArchive, config: tConfig }[tab] || tUsers)();
    }

    /* ---- Users CRUD ---- */
    async function tUsers() {
      const box = el('div');
      pane.append(el('div', { class: 'btnrow mb' }, el('button', { class: 'btn primary', onclick: newUser }, '+ Create User')), box);
      await load();
      async function load() {
        const res = await API.get('/admin/users?pageSize=100');
        box.innerHTML = '';
        box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
          columns: [
            { key: 'username', label: 'Username', render: r => el('b', {}, r.username) },
            { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
            { key: 'role_code', label: 'Role' },
            { key: 'organization_name', label: 'Organization' },
            { key: 'is_active', label: 'Active', render: r => r.is_active ? '✓' : '✗' },
            { key: 'mfa_secret', label: 'MFA', render: r => r.mfa_secret ? '🔒 enabled' : '—' },
            { key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
              el('button', { class: 'btn sm', onclick: () => editUser(r) }, 'Edit'),
              el('button', { class: 'btn sm', onclick: () => resetPwd(r) }, 'Reset pwd'),
              r.mfa_secret ? el('button', { class: 'btn sm', onclick: () => mfaOff(r) }, 'Disable MFA') :
                el('button', { class: 'btn sm', onclick: () => mfaOn(r) }, 'Enable MFA')) }
          ],
          rows: res.data
        }))));
      }
      async function roleOptions() { return (await API.get('/admin/roles')).data.map(r => [r.code, `${r.code} — ${r.name}`]); }
      async function newUser() {
        const [roles, orgs, deps] = await Promise.all([roleOptions(), API.get('/lookups/organizations'), API.get('/lookups/departments')]);
        const username = UI.input(); const full = UI.input(); const email = UI.input({ type: 'email' });
        const pwd = UI.input({ type: 'password', value: 'Password123!' });
        const role = UI.select(await roles);
        const org = UI.select([['', '—'], ...orgs.data.map(o => [o.id, o.name])]);
        const dep = UI.select([['', '—'], ...deps.data.map(d => [d.id, d.name])]);
        UI.modal('Create user', el('div', { class: 'frm-grid' },
          UI.field('Username *', username, true), UI.field('Full name *', full, true),
          UI.field('Email *', email, true), UI.field('Initial password *', pwd, true),
          UI.field('Role *', role), UI.field('Organization', org), UI.field('Department', dep)), {
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Create', kind: 'primary', onClick: async close => {
              try {
                await API.post('/admin/users', {
                  username: username.value, full_name: full.value, email: email.value,
                  password: pwd.value, role_code: role.value,
                  organization_id: org.value ? Number(org.value) : undefined,
                  department_id: dep.value ? Number(dep.value) : undefined
                });
                UI.toast('User created', 'ok'); close(); load();
              } catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      }
      function editUser(r) {
        Promise.all([roleOptions(), API.get('/lookups/organizations'), API.get('/lookups/departments')]).then(async ([roles, orgs, deps]) => {
          const full = UI.input({ value: r.full_name }); const email = UI.input({ value: r.email });
          const role = UI.select(await roles); role.value = r.role_code;
          const active = el('input', { type: 'checkbox' }); active.checked = !!r.is_active;
          UI.modal('Edit user ' + r.username, el('div', {},
            UI.field('Full name', full), UI.field('Email', email), UI.field('Role', role),
            el('label', { class: 'f' }, el('span', {}, 'Active'), active)), {
            actions: [{ label: 'Cancel', onClick: c => c() }, {
              label: 'Save', kind: 'primary', onClick: async close => {
                try {
                  await API.put('/admin/users/' + r.id, { full_name: full.value, email: email.value, role_code: role.value, is_active: active.checked ? 1 : 0 });
                  UI.toast('Saved (permission change audited)', 'ok'); close(); load();
                } catch (e) { UI.toast(e.message, 'err'); }
              }
            }]
          });
        });
      }
      function resetPwd(r) {
        API.post(`/admin/users/${r.id}/reset-password`).then(res => UI.modal('Temporary password',
          el('div', {}, el('p', {}, `New temporary password for ${r.username}:`), el('code', { class: 'mono', style: 'font-size:16px' }, res.data.temporary_password)),
          {})).catch(e => UI.toast(e.message, 'err'));
      }
      async function mfaOn(r) {
        const res = await API.post(`/admin/users/${r.id}/mfa-enable`);
        UI.modal('MFA enrollment — ' + r.username, el('div', {},
          el('p', {}, 'Share this secret with the user to add in their authenticator app:'),
          el('code', { class: 'mono' }, res.data.secret), el('p', { class: 'small muted' }, `Current code (for testing): ${res.data.sample_code}`)), {});
      }
      async function mfaOff(r) { try { await API.post(`/admin/users/${r.id}/mfa-disable`); UI.toast('MFA disabled', 'ok'); load(); } catch (e) { UI.toast(e.message, 'err'); } }
    }

    /* ---- Roles & permissions matrix ---- */
    async function tRoles() {
      const roles = (await API.get('/admin/roles')).data;
      const sel = UI.select(roles.map(r => [r.id, `${r.code} — ${r.name}`]));
      const box = el('div');
      sel.addEventListener('change', loadPerms);
      pane.append(el('div', { class: 'card mb' }, el('div', { class: 'bd btnrow' }, el('span', {}, 'Role: '), sel)), box);
      async function loadPerms() {
        const perms = (await API.get('/admin/permissions?role_id=' + sel.value)).data;
        box.innerHTML = '';
        const groups = {};
        for (const p of perms) (groups[p.domain] = groups[p.domain] || []).push(p);
        const holder = el('div');
        for (const [dom, ps] of Object.entries(groups)) {
          holder.append(el('h4', { style: 'margin:14px 0 6px' }, dom),
            ...ps.map(p => el('label', { style: 'display:flex;gap:8px;font-size:13px;padding:2px 0' },
              el('input', { type: 'checkbox', value: p.code, checked: p.granted ? true : null }), `${p.code} — ${p.description}`)));
        }
        box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, holder,
          el('button', { class: 'btn primary mt', onclick: save }, 'Save permissions'))));
      }
      async function save() {
        const codes = [...box.querySelectorAll('input:checked')].map(i => i.value);
        try { await API.put(`/admin/roles/${sel.value}/permissions`, { permission_codes: codes }); UI.toast('Permissions saved', 'ok'); loadPerms(); }
        catch (e) { UI.toast(e.message, 'err'); }
      }
      loadPerms();
    }

    /* ---- Taxonomy master data (configurable) ---- */
    async function tTaxonomy() {
      const TABLES = [
        ['projects', 'Projects'], ['contracts', 'Contracts'], ['organizations', 'Organizations'],
        ['departments', 'Departments'], ['disciplines', 'Disciplines'], ['document_types', 'Document Types'],
        ['categories', 'Categories'], ['purposes', 'Purpose of Issue'], ['retention_rules', 'Retention Classes']
      ];
      const sel = UI.select(TABLES.map(([k, l]) => [k, l]));
      const box = el('div');
      sel.addEventListener('change', loadTbl);
      pane.append(el('div', { class: 'card mb' }, el('div', { class: 'bd btnrow' }, sel,
        el('button', { class: 'btn primary sm', onclick: addRow }, '+ Add record'))), box);
      await loadTbl();

      const FIELDS = {
        projects: ['code', 'name', 'lifecycle_stage', 'status', 'customer_org_id', 'archive_trigger_stage'],
        contracts: [['number', 'Number'], ['title', 'Title'], ['project_id', 'Project ID'], ['customer_org_id', 'Customer Org ID'], ['contractor_org_id', 'Contractor Org ID'], ['status', 'Status']],
        organizations: ['code', 'name', 'org_type', 'contact_name', 'contact_email'],
        departments: ['code', 'name'], disciplines: ['code', 'name'], categories: ['code', 'name'], purposes: ['code', 'name'],
        retention_rules: ['code', 'name', 'retention_years', 'description'],
        document_types: ['code', 'name', 'requires_review', 'requires_endorsement', 'requires_approval', 'numbering_rule_id']
      };

      async function loadTbl() {
        const res = await API.get('/admin/' + sel.value + '?pageSize=500');
        const cols = FIELDS[sel.value].map(f => Array.isArray(f) ? f : [f, f]);
        box.innerHTML = '';
        box.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
          columns: [...cols.map(([f, l]) => ({ key: f, label: String(l).replace(/_/g, ' ') })),
            { key: 'is_active', label: 'Active', render: r => r.is_active ? '✓' : '✗' },
            { key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
              el('button', { class: 'btn sm', onclick: () => editRec(r) }, 'Edit'),
              r.is_active ? el('button', { class: 'btn sm danger', onclick: () => deact(r) }, 'Deactivate') : null) }
          ],
          rows: res.data
        }))));

        function formFor(rec) {
          const inputs = {};
          const grid = el('div', { class: 'frm-grid' });
          for (const [f, l] of cols) {
            const inp = UI.input({ value: rec && rec[f] != null ? rec[f] : '' });
            if (/^requires_|is_/.test(f)) inp.type = 'checkbox';
            inputs[f] = inp;
            grid.append(UI.field(String(l).replace(/_/g, ' '), inp));
          }
          return { grid, collect: () => {
            const body = {};
            for (const [f] of cols) {
              const v = inputs[f];
              if (v.type === 'checkbox') body[f] = v.checked ? 1 : 0;
              else if (String(v.value).trim() !== '') body[f] = isNaN(Number(v.value)) || /^code|^name|^title|stage|type|status|description|contact|email/.test(f) ? v.value.trim() : Number(v.value);
            }
            return body;
          } };
        }
        function addRow() {
          const { grid, collect } = formFor(null);
          UI.modal('Add ' + sel.options[sel.selectedIndex].text, grid, {
            actions: [{ label: 'Cancel', onClick: c => c() }, {
              label: 'Create', kind: 'primary', onClick: async close => {
                try { await API.post('/admin/' + sel.value, collect()); UI.toast('Created', 'ok'); close(); loadTbl(); }
                catch (e) { UI.toast(e.message, 'err'); }
              }
            }]
          });
        }
        function editRec(r) {
          const { grid, collect } = formFor(r);
          UI.modal('Edit record #' + r.id, grid, {
            actions: [{ label: 'Cancel', onClick: c => c() }, {
              label: 'Save', kind: 'primary', onClick: async close => {
                try { await API.put(`/admin/${sel.value}/${r.id}`, collect()); UI.toast('Saved', 'ok'); close(); loadTbl(); }
                catch (e) { UI.toast(e.message, 'err'); }
              }
            }]
          });
        }
        async function deact(r) {
          try { await API.del(`/admin/${sel.value}/${r.id}`); UI.toast('Deactivated (soft)', 'ok'); loadTbl(); }
          catch (e) { UI.toast(e.message, 'err'); }
        }
      }
    }

    /* ---- Status engine config ---- */
    async function tStatuses() {
      const [sts, trs] = await Promise.all([API.get('/admin/statuses'), API.get('/admin/status-transitions')]);
      const byId = {}; sts.data.forEach(s => byId[s.id] = s);
      pane.append(
        el('div', { class: 'card mb' }, el('div', { class: 'hd' }, el('h3', {}, 'Configured statuses')), el('div', { class: 'bd' }, UI.table({
          columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'scope', label: 'Scope' },
            { key: 'phase', label: 'Phase' }, { key: 'color', label: 'Colour', render: s => UI.badge(s.code, s.color) }],
          rows: sts.data
        }))),
        el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, 'Allowed transitions')), el('div', { class: 'bd' }, UI.table({
          columns: [
            { key: 'from_code', label: 'From', render: t => t.from_code || '(initial)' },
            { key: 'to_code', label: 'To' },
            { key: 'allowed_roles', label: 'Allowed roles', render: t => JSON.parse(t.allowed_roles).join(', ') || 'any permitted role' },
            { key: 'reason_required', label: 'Reason required', render: t => t.reason_required ? 'Yes' : 'No' }
          ],
          rows: trs.data
        }))));
    }

    /* ---- Numbering rules editor ---- */
    async function tNumbering() {
      const rules = (await API.get('/admin/numbering-rules')).data;
      pane.append(el('div', { class: 'grid g2' },
        rules.map(r => el('div', { class: 'card' }, el('div', { class: 'hd' }, el('h3', {}, r.code), UI.badge(r.entity_type)),
          el('div', { class: 'bd small' },
            el('dl', { class: 'kv' },
              el('dt', {}, 'Name'), el('dd', {}, r.name),
              el('dt', {}, 'Sequence'), el('dd', {}, `${r.sequence_scope} · ${r.sequence_length} digits`),
              el('dt', {}, 'Revision style'), el('dd', {}, r.revision_style)),
            el('b', { class: 'small' }, 'Pattern components'),
            el('div', { class: 'chips mt' }, JSON.parse(r.pattern).map(c =>
              el('span', { class: 'chip on' }, c.type === 'literal' ? `"${c.value}"` : '{' + c.value + '}'))))))));
    }

    /* ---- Workflow templates ---- */
    async function tWorkflows() {
      const wfs = (await API.get('/admin/workflows')).data;
      for (const w of wfs) {
        const steps = w.definition ? JSON.parse(w.definition).steps : [];
        pane.append(el('div', { class: 'card mb' }, el('div', { class: 'hd' },
          el('h3', {}, `${w.name} (${w.code})`), UI.el('span', { class: 'tag' }, 'v' + w.version_no),
          UI.el('span', { class: 'tag' }, w.entity_type)),
          el('div', { class: 'bd' }, UI.table({
            columns: [
              { key: 'key', label: 'Key', render: s => el('code', { class: 'mono' }, s.key) },
              { key: 'name', label: 'Step' },
              { key: 'type', label: 'Type' },
              { key: 'assignee_value', label: 'Assignee (role)' },
              { key: 'deadline_hours', label: 'SLA hours', render: s => s.deadline_hours || '—' }
            ],
            rows: steps
          }))));
      }
    }

    /* ---- Notification rules ---- */
    async function tNotifications() {
      const rules = (await API.get('/admin/notification-rules')).data;
      const rows = rules.map(r => ({
        ...r,
        _toggles: el('div', { class: 'btnrow' },
          toggleBtn(r, 'inapp_enabled', 'In-app'), toggleBtn(r, 'email_enabled', 'Email'))
      }));
      function toggleBtn(rule, field, label) {
        return el('button', { class: 'btn sm' + (rule[field] ? ' good' : ''), onclick: async e => {
          try { await API.put('/admin/notification-rules/' + rule.id, { [field]: rule[field] ? 0 : 1 }); loadTab(); }
          catch (err) { UI.toast(err.message, 'err'); }
        }}, label + ': ' + (rule[field] ? 'on' : 'off'));
      }
      function loadTab() { pane.innerHTML = ''; tNotifications(); }
      pane.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'event_code', label: 'Event', render: r => el('code', { class: 'mono' }, r.event_code) },
          { key: 'description', label: 'Description' },
          { key: 'target_mode', label: 'Targets' },
          { key: 'inapp_enabled', label: 'Channels', render: r => r._toggles },
          { key: 'is_active', label: 'Active', render: r => r.is_active ? '✓' : '✗' }
        ],
        rows
      }))));
    }

    async function tSla() {
      const rules = (await API.get('/admin/sla-rules')).data;
      pane.append(el('div', { class: 'card mb' }, el('div', { class: 'bd' }, UI.table({
        columns: [{ key: 'code', label: 'Rule' }, { key: 'entity_type', label: 'Entity' },
          { key: 'days', label: 'Days allowed' }, { key: 'escalate_after_days', label: 'Escalate after (days)' }],
        rows: rules
      }))),
        el('p', { class: 'small muted' }, 'The scheduler checks deadlines every minute: approaching-deadline warnings, overdue escalation notifications and resolution status escalation.'));
    }

    async function tArchive() {
      const recs = (await API.get('/archive')).data;
      pane.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'reference', label: 'Document', render: r => el('a', { href: '#/documents/' + r.entity_id }, r.reference || '#' + r.entity_id) },
          { key: 'reason', label: 'Reason' },
          { key: 'archived_by_name', label: 'Archived by' },
          { key: 'archived_at', label: 'Archived at', render: r => UI.fmtDT(r.archived_at) },
          { key: 'disposition_due', label: 'Disposition due', render: r => r.disposition_due || '—' },
          { key: 'dispositioned_at', label: 'Dispositioned', render: r => r.dispositioned_at ? UI.fmtDT(r.dispositioned_at) : '—' }
        ],
        rows: recs,
        emptyText: 'Nothing archived yet'
      }))),
        el('p', { class: 'small muted' }, 'Physical disposition is only possible after the retention period and requires explicit confirmation; all actions are audited.'));
    }

    async function tConfig() {
      const cfgs = (await API.get('/admin/configurations')).data;
      pane.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'key', label: 'Setting', render: r => el('code', { class: 'mono' }, r.key) },
          { key: 'value', label: 'Value' },
          { key: 'description', label: 'Description' },
          { key: 'updated_at', label: 'Updated', render: r => UI.fmtDT(r.updated_at) },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm', onclick: () => editCfg(r) }, 'Edit') }
        ],
        rows: cfgs
      }))));
      function editCfg(r) {
        const val = UI.input({ value: r.value });
        UI.modal('Edit setting: ' + r.key, UI.field('Value', val), {
          actions: [{ label: 'Cancel', onClick: c => c() }, {
            label: 'Save', kind: 'primary', onClick: async close => {
              try { await API.put('/admin/configurations/' + encodeURIComponent(r.key), { value: val.value }); UI.toast('Saved', 'ok'); close(); renderTab(); }
              catch (e) { UI.toast(e.message, 'err'); }
            }
          }]
        });
      }
    }

    root.append(bar, pane);
    await renderTab();
  }
};
