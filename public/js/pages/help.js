/* Help Center — system documentation and support */
window.Pages = window.Pages || {};
Pages.helpCenter = {
  title: 'Help & Support',
  async render(root) {
    document.querySelector('.topbar .title').textContent = 'Help & Support';

    const sections = [
      {
        title: 'Getting Started',
        icon: '📘',
        items: [
          { q: 'What is the IDMS?', a: 'The Integrated Document Management System (IDMS) is an enterprise platform for managing controlled documents, correspondence, transmittals, approvals, and workflows in an Oil & Gas project environment.' },
          { q: 'How do I upload a document?', a: 'Click "Register Document" on the Document Register page. Drag files into the drop zone, fill in the required fields (Title, Project, Document Type), and click "Upload & Register". Files up to 200 MB are supported.' },
          { q: 'How do I search for documents?', a: 'Use the search box in the top header (Ctrl+K) for quick search, or go to Advanced Search for multi-filter queries with date ranges, exact matching, and saved templates.' },
          { q: 'How do I print a document?', a: 'Open the document detail page and click "Print" for the browser print dialog, or "Print Cover Sheet" for a professional cover sheet layout.' }
        ]
      },
      {
        title: 'Document Lifecycle',
        icon: '🔄',
        items: [
          { q: 'What are the document statuses?', a: 'Draft → Under Review → Endorsed → Under Approval → Approved → Issued → Distributed → Closed → Archived. Each transition is controlled by role-based permissions.' },
          { q: 'How do I create a new revision?', a: 'Open the document detail page. If you have revision permissions, click "New Revision". The current revision is superseded and a new draft is created.' },
          { q: 'What is the difference between Incoming and Outgoing?', a: 'Incoming (LOIR) documents are received from external parties. Outgoing documents are issued from your organization. Both follow controlled registration and distribution processes.' }
        ]
      },
      {
        title: 'Correspondence & Transmittals',
        icon: '📬',
        items: [
          { q: 'How do I register incoming correspondence?', a: 'Go to Incoming Correspondence and click "Register". Fill in the sender, subject, response requirements, and attach the original file. The system calculates response deadlines based on urgency.' },
          { q: 'How do I create a transmittal?', a: 'Go to Transmittals and click "Create Transmittal". Select the documents to include, add recipients, set the purpose, and issue. Recipients receive notification and can acknowledge receipt.' },
          { q: 'How do I track responses?', a: 'The system tracks response deadlines automatically. Overdue items appear in the Dashboard KPIs and the Audit Trail. Use Reports to generate overdue correspondence reports.' }
        ]
      },
      {
        title: 'Administration',
        icon: '⚙',
        items: [
          { q: 'How do I add a new document type?', a: 'Go to Administration → Code Registry and select DOCTYPE. Click "Add Code" to create a new document type with a unique code and description.' },
          { q: 'How do I manage user permissions?', a: 'Go to Administration → Roles & Permissions. Select a role and toggle the permissions matrix. Changes take effect immediately.' },
          { q: 'How do I configure DDM rules?', a: 'Go to Distribution Matrix (DDM). Create rules that match documents by Discipline, Type, Class, or Originator to automatically assign Reviewers, Endorsers, and Approvers.' }
        ]
      },
      {
        title: 'Keyboard Shortcuts',
        icon: '⌨',
        items: [
          { q: 'Ctrl+K — Global Search', a: 'Focus the search box in the top header to quickly search for documents.' },
          { q: 'Enter — Submit Form', a: 'In most forms and search boxes, pressing Enter submits the form or triggers the search.' },
          { q: 'Click row to open', a: 'In any table, clicking a row opens the detail view for that record.' }
        ]
      }
    ];

    root.append(el('div', { class: 'card mb' },
      el('div', { class: 'bd' },
        el('div', { class: 'empty-state', style: 'text-align:left' },
          el('h2', { style: 'margin:0 0 8px' }, 'UEF IDMS — Help & Support'),
          el('p', { class: 'muted' }, 'Enterprise Integrated Document Management System v2.0'),
          el('p', { class: 'muted' }, 'For technical support, contact the Document Control team.')))));

    for (const sec of sections) {
      const items = sec.items.map(item =>
        el('div', { class: 'help-item', style: 'margin-bottom:12px;padding:12px;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--line)' },
          el('div', { style: 'font-weight:600;margin-bottom:4px' }, item.q),
          el('div', { class: 'muted small', style: 'line-height:1.6' }, item.a)));

      root.append(el('div', { class: 'card mb' },
        el('div', { class: 'hd' }, el('h3', {}, `${sec.icon} ${sec.title}`)),
        el('div', { class: 'bd' }, ...items)));
    }
  }
};
