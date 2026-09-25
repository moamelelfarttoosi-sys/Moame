/* Operations command center — KPIs, quick actions, activity, charts */
window.Pages = window.Pages || {};
Pages.dashboard = {
  title: 'Dashboard',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Operations Dashboard';

    const [sum, charts] = await Promise.all([
      API.get('/dashboard/summary'),
      API.get('/dashboard/charts')
    ]);
    const c = sum.data.counters, t = sum.data.my_tasks;
    const who = API.getProfile();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    // ---- KPI helper ----
    const stat = (label, n, cls, icon, href) => {
      const card = el('div', { class: `card stat ${cls || ''}` },
        icon ? el('div', { class: 'k' }, icon) : null,
        el('div', { class: 'n' }, String(n ?? 0)),
        el('div', { class: 'l' }, label));
      return href ? el('a', { href, class: 'statlink' }, card) : card;
    };

    // ---- page header ----
    root.append(UI.pageHeader({
      title: `${greet}, ${(who?.full_name || '').split(' ')[0] || 'there'}`,
      desc: 'Your document-control command center — outstanding actions, register health and recent activity at a glance.'
    }));

    // ---- quick actions ----
    const qa = (icon, title, sub, cls, onClick, perm) => {
      if (perm && !API.can(perm)) return null;
      return el('button', { class: `qa ${cls || ''}`, onclick: onClick },
        el('div', { class: 'qa-i' }, icon),
        el('div', {}, el('div', { class: 'qa-t' }, title), el('div', { class: 'qa-s' }, sub)));
    };
    const actions = [
      qa('＋', 'Register Document', 'Upload & catalogue', '', () => window.openRegisterModal && window.openRegisterModal(() => location.hash = '#/documents'), 'document.create'),
      qa('📷', 'Scan & Import', 'From scanner or PDF', 'g', () => window.openScanImportModal && window.openScanImportModal(() => location.hash = '#/documents'), 'document.create'),
      qa('📤', 'Create Transmittal', 'Issue to recipients', 'v', () => location.hash = '#/transmittals'),
      qa('✉', 'Correspondence', 'Incoming & outgoing', 'w', () => location.hash = '#/correspondence'),
      qa('🔍', 'Advanced Search', 'Query the register', '', () => location.hash = '#/search'),
      qa('📊', 'Reports', 'Export & analyse', '', () => location.hash = '#/reports')
    ].filter(Boolean);
    root.append(el('div', { class: 'qa-grid mb' }, actions));

    // ---- KPI: register overview ----
    root.append(el('div', { class: 'section-title mt' }, 'Register overview'));
    root.append(el('div', { class: 'grid g6 mb' },
      stat('Total Documents', c.total_documents, 'info', '📄', '#/documents'),
      stat('Incoming', c.incoming, '', '⬇', '#/documents?direction=incoming'),
      stat('Outgoing', c.outgoing, '', '⬆', '#/documents'),
      stat('Approved', c.approved, 'good', '✔', '#/documents'),
      stat('Referred to Contractor', c.referred_to_contractor, '', '↩'),
      stat('Awaiting Acknowledgement', c.transmittals_awaiting_ack, '', '📤', '#/transmittals')
    ));

    // ---- KPI: action required ----
    root.append(el('div', { class: 'section-title' }, 'Requires action'));
    root.append(el('div', { class: 'grid g6 mb' },
      stat('Pending Review', c.pending_review, c.pending_review ? 'warn' : '', '📝', '#/tasks?tab=reviews'),
      stat('Pending Endorsement', c.pending_endorsement, c.pending_endorsement ? 'warn' : '', '🖊', '#/tasks?tab=endorsements'),
      stat('Pending Approval', c.pending_approval, c.pending_approval ? 'warn' : '', '✔', '#/approvals'),
      stat('Overdue Reviews', c.overdue_reviews, c.overdue_reviews ? 'bad' : '', '⏰', '#/tasks?tab=reviews'),
      stat('Rejected', c.rejected, c.rejected ? 'bad' : '', '✕'),
      stat('Open Resolutions', c.open_resolutions, c.escalated ? 'bad' : (c.open_resolutions ? 'warn' : ''), '⚖', '#/resolutions')
    ));

    // ---- charts + activity ----
    const recentBox = el('div', { class: 'card' },
      el('div', { class: 'hd' }, el('h3', {}, 'Recently registered'),
        el('div', { class: 'hd-a' }, el('a', { class: 'btn sm', href: '#/documents' }, 'Open register'))),
      el('div', { class: 'bd tight' }, el('div', { style: 'padding:16px' }, UI.skeletonTable(4, 5))));

    root.append(el('div', { class: 'grid g2' },
      el('div', { class: 'card' },
        el('div', { class: 'hd' }, el('h3', {}, 'Status distribution')),
        el('div', { class: 'bd', style: 'display:flex;gap:22px;flex-wrap:wrap;align-items:center' },
          UI.donut(charts.data.status_distribution.map(s => ({ label: s.label, value: s.value, color: s.color }))),
          UI.legend(charts.data.status_distribution))),
      recentBox,
      el('div', { class: 'card' },
        el('div', { class: 'hd' }, el('h3', {}, 'Registration volume (monthly)')),
        el('div', { class: 'bd' },
          charts.data.volume_trend.length ? UI.bars(charts.data.volume_trend) : el('div', { class: 'muted small', style: 'padding:14px 0' }, 'No registration activity recorded yet.'))),
      el('div', { class: 'card' },
        el('div', { class: 'hd' }, el('h3', {}, 'Documents by discipline')),
        el('div', { class: 'bd' },
          UI.bars(charts.data.by_discipline),
          el('div', { class: 'chart-legend mt', style: 'flex-direction:row;flex-wrap:wrap;gap:6px 16px' },
            charts.data.by_discipline.slice(0, 6).map(d => el('span', {}, `${d.label}: `, el('b', {}, String(d.value))))))),
      el('div', { class: 'card' },
        el('div', { class: 'hd' }, el('h3', {}, 'My open tasks')),
        el('div', { class: 'bd' },
          el('div', { class: 'grid g4' },
            taskCard('Reviews', t.reviews, '#/tasks?tab=reviews'),
            taskCard('Endorsements', t.endorsements, '#/tasks?tab=endorsements'),
            taskCard('Approvals', t.approvals, '#/approvals'),
            taskCard('Resolutions', t.resolutions, '#/resolutions?mine=1')),
          el('hr', { class: 'sep' }),
          el('div', { class: 'small muted' }, `Average review completion time: ${charts.data.review_sla_avg_days ?? 0} days`)))
    ));

    // ---- load recent documents ----
    try {
      const recent = await API.get('/documents?pageSize=6');
      const body = recentBox.querySelector('.bd');
      body.innerHTML = '';
      body.append(UI.table({
        compact: true,
        columns: [
          { key: 'doc_number', label: 'Number', render: r => el('span', { class: 'mono', style: 'font-size:11.5px' }, r.doc_number || '—') },
          { key: 'title', label: 'Title', render: r => el('span', { class: 'truncate', title: r.title, style: 'max-width:220px' }, r.title || '—') },
          { key: 'internal_status_code', label: 'Status', render: r => UI.statusPill(r.internal_status_code) },
          { key: 'receipt_date', label: 'Received', className: 'nowrap', render: r => UI.fmtDate(r.receipt_date) }
        ],
        rows: recent.data,
        empty: { icon: '📄', title: 'No documents yet', message: 'Register your first document to get started.' },
        onRow: r => { location.hash = '#/documents/' + r.id; }
      }));
    } catch {
      recentBox.querySelector('.bd').innerHTML = '<div class="muted small" style="padding:16px">Could not load recent documents.</div>';
    }

    function taskCard(label, n, href) {
      return el('a', { href, class: 'statlink' },
        el('div', { class: `card stat ${n ? 'warn' : ''}` }, el('div', { class: 'n' }, String(n)), el('div', { class: 'l' }, label)));
    }
  }
};
