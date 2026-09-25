/* Approvals Center — dedicated approval management */
window.Pages = window.Pages || {};
Pages.approvalCenter = {
  title: 'Approval Center',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Approval Center';

    const [myApprovals, allApprovals] = await Promise.all([
      API.get('/approvals/mine').catch(() => ({ data: [] })),
      API.get('/approvals').catch(() => ({ data: [] }))
    ]);

    const state = { tab: 'mine' };

    function render() {
      root.innerHTML = '';
      const tabs = el('div', { class: 'tabs' },
        el('button', { class: state.tab === 'mine' ? 'active' : '', onclick: () => { state.tab = 'mine'; render(); } },
          `My Approvals (${myApprovals.data.length})`),
        el('button', { class: state.tab === 'all' ? 'active' : '', onclick: () => { state.tab = 'all'; render(); } },
          `All Approvals (${allApprovals.data.length})`));

      const data = state.tab === 'mine' ? myApprovals.data : allApprovals.data;
      const pending = data.filter(a => a.status === 'in_progress');
      const completed = data.filter(a => a.status !== 'in_progress');

      const pendingCard = el('div', { class: 'card mb' },
        el('div', { class: 'hd' }, el('h3', {}, `Pending (${pending.length})`)),
        el('div', { class: 'bd' },
          UI.table({
            columns: [
              { key: 'document_number', label: 'Document', render: r => el('a', { href: '#/documents/' + r.document_id }, r.document_number || '—') },
              { key: 'revision_code', label: 'Rev' },
              { key: 'mode', label: 'Mode' },
              { key: 'initiated_by_name', label: 'Requested by' },
              { key: 'initiated_at', label: 'Initiated', render: r => UI.fmtDT(r.initiated_at) },
              { key: 'deadline_at', label: 'Due', render: r => r.deadline_at ? UI.fmtDT(r.deadline_at) : '—' },
              { key: '_act', label: '', render: r => el('div', { class: 'btnrow' },
                el('button', { class: 'btn sm primary', onclick: () => approveModal(r) }, 'Decide')) }
            ],
            rows: pending,
            emptyText: 'No pending approvals'
          })));

      const completedCard = el('div', { class: 'card mb' },
        el('div', { class: 'hd' }, el('h3', {}, `Completed (${completed.length})`)),
        el('div', { class: 'bd' },
          UI.table({
            columns: [
              { key: 'document_number', label: 'Document', render: r => el('a', { href: '#/documents/' + r.document_id }, r.document_number || '—') },
              { key: 'revision_code', label: 'Rev' },
              { key: 'mode', label: 'Mode' },
              { key: 'initiated_by_name', label: 'Requested by' },
              { key: 'status', label: 'Status', render: r => UI.badge(r.status, r.status === 'approved' ? '#0e9f6e' : r.status === 'rejected' ? '#d64545' : '#94a3b8') },
              { key: 'acted_at', label: 'Acted', render: r => r.acted_at ? UI.fmtDT(r.acted_at) : '—' }
            ],
            rows: completed,
            emptyText: 'No completed approvals'
          })));

      root.append(tabs, pendingCard, completedCard);
    }

    function approveModal(approval) {
      const comments = el('textarea', { placeholder: 'Comments…' });
      UI.modal('Review & Decide', el('div', {},
        el('div', { class: 'frm-grid' },
          el('div', {}, el('b', {}, 'Document: '), el('a', { href: '#/documents/' + approval.document_id }, approval.document_number || 'Doc #' + approval.document_id)),
          el('div', {}, el('b', {}, 'Revision: '), approval.revision_code),
          el('div', {}, el('b', {}, 'Mode: '), approval.mode),
          el('div', {}, el('b', {}, 'Requested by: '), approval.initiated_by_name),
          el('div', {}, el('b', {}, 'Initiated: '), UI.fmtDT(approval.initiated_at))),
        UI.field('Comments', comments)
      ), {
        actions: [
          { label: 'Cancel', onClick: c => c() },
          { label: 'Reject', kind: 'danger', onClick: async c => {
            try {
              await API.post(`/approvals/${approval.id}/steps/0/act`, { decision: 'rejected', comments: comments.value });
              UI.toast('Approval rejected', 'ok'); c(); location.reload();
            } catch (e) { UI.toast(e.message, 'err'); }
          }},
          { label: 'Approve', kind: 'primary', onClick: async c => {
            try {
              await API.post(`/approvals/${approval.id}/steps/0/act`, { decision: 'approved', comments: comments.value });
              UI.toast('Approved', 'ok'); c(); location.reload();
            } catch (e) { UI.toast(e.message, 'err'); }
          }}
        ]
      });
    }

    render();
  }
};
