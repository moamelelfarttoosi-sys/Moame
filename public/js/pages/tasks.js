/* My Tasks: reviews, endorsements, approvals */
window.Pages = window.Pages || {};
Pages.tasks = {
  async render(root, params, query) {
    let tab = query.tab || 'reviews';
    const body = el('div');
    document.querySelector('.topbar .title').textContent = 'My Tasks';

    const bar = el('div', { class: 'tabs' },
      ['reviews', 'endorsements', 'approvals'].map(t => {
        return el('button', { class: t === tab ? 'active' : '', onclick: () => { tab = t; renderTab(); updateBar(); } },
          t[0].toUpperCase() + t.slice(1));
      }));
    function updateBar() {
      [...bar.children].forEach((b, i) => b.classList.toggle('active', ['reviews', 'endorsements', 'approvals'][i] === tab));
    }

    async function renderTab() {
      body.innerHTML = '';
      if (tab === 'reviews') await renderReviews();
      else if (tab === 'endorsements') await renderEndorsements();
      else renderApprovals();
    }

    async function renderReviews() {
      const res = await API.get('/reviews/mine');
      body.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'doc_number', label: 'Document' }, { key: 'revision_code', label: 'Rev' },
          { key: 'doc_title', label: 'Title' },
          { key: 'review_due_date', label: 'Due', render: r => UI.fmtDate(r.review_due_date) },
          { key: 'status', label: 'Status' },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm primary', onclick: () => openReview(r) }, 'Review') }
        ],
        rows: res.data,
        emptyText: 'No reviews assigned to you'
      }))));

      function openReview(r) {
        const comment = UI.textarea({ placeholder: 'Review comments…' });
        const act = (outcome, label, kind) => ({
          label, kind,
          onClick: async close => {
            try {
              if (comment.value.trim()) await API.post(`/reviews/${r.id}/comments`, { comment: comment.value });
              await API.post(`/reviews/${r.id}/complete`, { outcome, comments: comment.value || undefined });
              UI.toast('Review submitted', 'ok'); close(); renderTab();
            } catch (e) { UI.toast(e.message, 'err'); }
          }
        });
        UI.modal(`Technical Review — ${r.doc_number} Rev ${r.revision_code}`, el('div', {},
          el('p', {}, r.doc_title),
          el('a', { href: '#/documents/' + r.document_id, target: '_blank' }, 'Open document workspace ↗'),
          el('hr', { class: 'sep' }),
          UI.field('Comments / findings', comment)), {
          lg: true,
          actions: [
            { label: 'Close', onClick: c => c() },
            act('request_changes', 'Request Changes'),
            act('return_to_dcc', 'Return to DCC'),
            act('reject', 'Reject', 'danger'),
            act('approve', 'Approve Review', 'good')
          ]
        });
      }
    }

    async function renderEndorsements() {
      const res = await API.get('/endorsements/mine');
      body.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'doc_number', label: 'Document' }, { key: 'revision_code', label: 'Rev' },
          { key: 'doc_title', label: 'Title' },
          { key: 'assigned_at', label: 'Assigned', render: r => UI.fmtDT(r.assigned_at) },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm primary', onclick: () => openEnd(r) }, 'Endorse') }
        ],
        rows: res.data, emptyText: 'Nothing awaiting your endorsement'
      }))));
      function openEnd(r) {
        const comments = UI.textarea();
        UI.modal(`Endorsement — ${r.doc_number} Rev ${r.revision_code}`, el('div', {},
          el('p', {}, r.doc_title), UI.field('Comments', comments)), {
          actions: [{ label: 'Cancel', onClick: c => c() },
            { label: 'Reject', kind: 'danger', onClick: act('reject') },
            { label: 'Return', onClick: act('return') },
            { label: 'Endorse', kind: 'good', onClick: act('endorse') }]
        });
        function act(decision) {
          return async close => {
            try { await API.post(`/endorsements/${r.id}/act`, { decision, comments: comments.value || undefined }); UI.toast('Recorded', 'ok'); close(); renderTab(); }
            catch (e) { UI.toast(e.message, 'err'); }
          };
        }
      }
    }

    async function renderApprovals() {
      const res = await API.get('/approvals/mine');
      body.append(el('div', { class: 'card' }, el('div', { class: 'bd' }, UI.table({
        columns: [
          { key: 'doc_number', label: 'Document' }, { key: 'revision_code', label: 'Rev' },
          { key: 'doc_title', label: 'Title' },
          { key: 'mode', label: 'Mode' },
          { key: 'deadline_at', label: 'Deadline', render: r => UI.fmtDT(r.deadline_at) },
          { key: '_act', label: '', render: r => el('button', { class: 'btn sm primary', onclick: () => openAppr(r) }, 'Decide') }
        ],
        rows: res.data, emptyText: 'Nothing awaiting your approval'
      }))));
      function openAppr(r) {
        const comments = UI.textarea();
        UI.modal(`Approval — ${r.doc_number} Rev ${r.revision_code}`, el('div', {},
          el('p', {}, r.doc_title),
          el('a', { href: '#/documents/' + r.document_id, target: '_blank' }, 'Open document workspace ↗'),
          el('hr', { class: 'sep' }), UI.field('Comments', comments),
          el('p', { class: 'small muted' }, `Step ${r.step_id} · mode: ${r.mode}`)), {
          actions: [{ label: 'Cancel', onClick: c => c() },
            { label: 'Delegate…', onClick: () => delegate(r) },
            { label: 'Reject', kind: 'danger', onClick: act('reject') },
            { label: 'Approve', kind: 'good', onClick: act('approve') }]
        });
        function act(decision) {
          return async close => {
            try {
              await API.post(`/approvals/${r.approval_id}/steps/${r.step_id}/act`, { decision, comments: comments.value || undefined });
              UI.toast('Decision recorded', 'ok'); close(); renderTab();
            } catch (e) { UI.toast(e.message, 'err'); }
          };
        }
        function delegate(r2) {
          API.get('/lookups/users').then(us => {
            const target = UI.select(us.data.filter(u => u.role_code === 'APPROVER').map(u => [u.id, u.full_name]));
            UI.modal('Delegate approval step', UI.field('Delegate to', target), {
              actions: [{ label: 'Cancel', onClick: c => c() }, {
                label: 'Delegate', kind: 'primary', onClick: async close => {
                  try {
                    await API.post(`/approvals/${r2.approval_id}/steps/${r2.step_id}/delegate`, { delegate_to: Number(target.value) });
                    UI.toast('Delegated', 'ok'); close(); renderTab();
                  } catch (e) { UI.toast(e.message, 'err'); }
                }
              }]
            });
          });
        }
      }
    }

    root.append(bar, body);
    await renderTab();
  }
};
