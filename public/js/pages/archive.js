/* Archive Center — dedicated archive management */
window.Pages = window.Pages || {};
Pages.archiveCenter = {
  title: 'Archive Center',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Archive Center';

    const archived = await API.get('/archive').catch(() => ({ data: [] }));

    root.append(
      el('div', { class: 'card mb' }, el('div', { class: 'hd' }, el('h3', {}, 'Archived Documents')),
        el('div', { class: 'bd' },
          UI.table({
            columns: [
              { key: 'doc_number', label: 'Document', render: r => el('a', { href: '#/documents/' + r.document_id }, r.doc_number || '—') },
              { key: 'title', label: 'Title' },
              { key: 'project_code', label: 'Project' },
              { key: 'archive_reason', label: 'Reason' },
              { key: 'archived_by_name', label: 'Archived by' },
              { key: 'archived_at', label: 'Archived', render: r => UI.fmtDate(r.archived_at) },
              { key: 'disposition_due', label: 'Disposition Due', render: r => r.disposition_due ? UI.fmtDate(r.disposition_due) : '—' }
            ],
            rows: archived.data,
            emptyText: 'No archived documents'
          }))),
      el('div', { class: 'card mb' }, el('div', { class: 'hd' }, el('h3', {}, 'Archive Information')),
        el('div', { class: 'bd' },
          el('p', { class: 'muted' }, 'Documents are archived when they reach Superseded or Closed status. Archived documents retain their full version history and audit trail.'),
          el('p', { class: 'muted' }, 'To archive a document: open the document detail page and click "Archive" when the document is in Superseded or Closed status.'),
          el('p', { class: 'muted' }, 'Disposition of archived documents requires administrator approval and is tracked in the audit trail.')))
    );
  }
};
