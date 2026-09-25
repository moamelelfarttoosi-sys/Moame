/* UI toolkit: dom builder, tables, modals, toasts, forms, charts */
window.UI = (() => {
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  const fmtDate = s => s ? String(s).slice(0, 10) : '—';
  const fmtDT = s => s ? String(s).slice(0, 16).replace('T', ' ') : '—';
  const esc = s => String(s == null ? '' : s);

  function badge(text, color) {
    return el('span', { class: 'badge' },
      el('i', { class: 'dot', style: `background:${color || '#8b97ad'};${color ? '' : 'background:#8b97ad'}` }),
      text || '—');
  }

  const TOAST_ICON = { ok: '✓', err: '⚠', warn: '⚠', '': 'ℹ' };
  function toast(msg, type = '') {
    let holder = document.querySelector('.toasts');
    if (!holder) { holder = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(holder); }
    const t = el('div', { class: `toast ${type}` },
      el('span', { class: 'ti' }, TOAST_ICON[type] || 'ℹ'),
      el('span', {}, msg));
    holder.append(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(() => t.remove(), 400); }, type === 'err' ? 5200 : 3200);
  }

  function modal(title, bodyEl, { actions = [], lg = false } = {}) {
    const mask = el('div', { class: 'modal-mask', onclick: e => { if (e.target === mask) close(); } });
    const xBtn = el('span', { class: 'x', title: 'Close', onclick: () => close() }, '✕');
    const foot = el('div', { class: 'mf' }, actions.map(a =>
      el('button', { class: `btn ${a.kind || ''}`, onclick: () => a.onClick(close) }, a.label)));
    const box = el('div', { class: `modal${lg ? ' lg' : ''}` },
      el('div', { class: 'mh' }, title, xBtn),
      el('div', { class: 'mb' }, bodyEl),
      actions.length ? foot : null);
    mask.append(box);
    document.body.append(mask);
    function close() { mask.remove(); }
    return { close };
  }

  /** columns: [{key,label,render?,sortable?,className?}]; opts: {emptyText, empty:{icon,title,message,actions}, compact} */
  function table({ columns, rows, onRow, emptyText, empty, compact }) {
    if (!rows || !rows.length) {
      const cell = el('td', { class: 'empty', colspan: String(columns.length) });
      cell.append(empty ? emptyState(empty) : (emptyText || 'No records match the current view.'));
      return el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('tbody', {}, el('tr', {}, cell))));
    }
    const head = el('tr', {}, columns.map(c => el('th', { class: c.className || '' }, c.label)));
    const body = rows.map(r => {
      const tr = el('tr', { class: onRow ? 'click' : '' },
        columns.map(c => {
          const td = el('td', { class: c.className || '' });
          td.append(c.render ? c.render(r) : esc(r[c.key]));
          return td;
        }));
      if (onRow) tr.addEventListener('click', (e) => { if (e.target.closest('.moremenu, .iact, button, a')) return; onRow(r); });
      return tr;
    });
    return el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' + (compact ? ' compact' : '') }, el('thead', {}, head), el('tbody', {}, body)));
  }

  function pager({ page, pageSize, total, onChange }) {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const wrap = el('div', { class: 'pager' });
    wrap.append(`${total} record${total === 1 ? '' : 's'} · page ${page}/${pages} `);
    const mk = (label, target, dis) => el('button', {
      class: 'btn sm', disabled: dis,
      onclick: () => onChange(target)
    }, label);
    wrap.append(mk('‹ Prev', Math.max(1, page - 1), page <= 1),
      mk('Next ›', Math.min(pages, page + 1), page >= pages));
    return wrap;
  }

  function field(labelText, inputEl, required) {
    return el('label', { class: 'f' }, el('span', { class: required ? 'req' : '' }, labelText), inputEl);
  }
  const input = (attrs = {}) => el('input', Object.assign({ type: 'text' }, attrs));
  const selectEl = (options, attrs = {}) => {
    const s = el('select', attrs);
    for (const o of options) {
      const [val, label] = Array.isArray(o) ? o : [o.id ?? o.code ?? o.value, o.name ?? o.label ?? String(o)];
      s.append(el('option', { value: val ?? '' }, label ?? ''));
    }
    return s;
  };
  const textareaEl = (attrs = {}) => el('textarea', attrs);

  /* ---- SVG charts ---- */
  function donut(data, size = 150) {
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    let acc = -Math.PI / 2;
    const r = size / 2 - 6, cx = size / 2, cy = size / 2;
    const svg = [`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`];
    for (const d of data) {
      const ang = (d.value / total) * Math.PI * 2;
      const x1 = cx + r * Math.cos(acc), y1 = cy + r * Math.sin(acc);
      acc += ang;
      const x2 = cx + r * Math.cos(acc), y2 = cy + r * Math.sin(acc);
      const large = ang > Math.PI ? 1 : 0;
      svg.push(`<path d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${d.color || '#1667d9'}" stroke="#fff" stroke-width="1.5"><title>${esc(d.label)}: ${d.value}</title></path>`);
    }
    svg.push(`<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#fff"/><text x="50%" y="52%" text-anchor="middle" font-size="20" font-weight="700" fill="#16233b">${total}</text></svg>`);
    const div = el('div');
    div.innerHTML = svg.join('');
    return div.firstChild;
  }

  function bars(data, { width = 100, height = 40 } = {}) {
    const max = Math.max(...data.map(d => d.value), 1);
    const bw = 100 / Math.max(data.length, 1);
    const parts = [`<svg width="100%" height="${height}" viewBox="0 0 100 ${height}" preserveAspectRatio="none">`];
    data.forEach((d, i) => {
      const h = (d.value / max) * (height - 14);
      parts.push(`<rect x="${i * bw + bw * 0.15}" y="${height - 12 - h}" width="${bw * 0.7}" height="${h}" rx="1.5" fill="#1667d9"><title>${esc(d.label)}: ${d.value}</title></rect>`);
      parts.push(`<text x="${i * bw + bw / 2}" y="${height - 2}" font-size="5.5" text-anchor="middle" fill="#5c6b84">${esc(String(d.label).slice(2))}</text>`);
    });
    parts.push('</svg>');
    const div = el('div');
    div.innerHTML = parts.join('');
    return div.firstChild;
  }

  function legend(data) {
    return el('div', { class: 'chart-legend' }, data.map(d =>
      el('div', {}, el('span', { class: 'sw', style: `background:${d.color || '#1667d9'}` }), `${d.label} — `, el('b', {}, String(d.value)))));
  }

  function statusBadge(codeNameColor) {
    return badge(codeNameColor?.name || codeNameColor || '—', codeNameColor?.color);
  }

  function downloadFile(url) {
    fetch(url, { headers: API.getToken() ? { Authorization: 'Bearer ' + API.getToken() } : {} })
      .then(async res => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || 'Download failed');
        const blob = await res.blob();
        const cd = res.headers.get('Content-Disposition') || '';
        const m = cd.match(/filename\*?=(?:UTF-8''|")?([^";]+)/);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = m ? decodeURIComponent(m[1]) : 'download';
        document.body.append(a); a.click(); a.remove();
      })
      .catch(e => toast(e.message, 'err'));
  }

  /* ---- semantic status mapping ---- */
  // Maps document/correspondence status codes to a semantic bucket so the same
  // status always reads the same colour across the whole system.
  const STATUS_GOOD = ['APP', 'APPROVED', 'CLOSED', 'COMPLETE', 'COMPLETED', 'ISSUED', 'ACK', 'ACKNOWLEDGED', 'ACC', 'ACCEPTED', 'ACTIVE', 'PUBLISHED', 'RELEASED'];
  const STATUS_WARN = ['PAP', 'URV', 'UNDER REVIEW', 'PENDING', 'PENDING APPROVAL', 'IN PROGRESS', 'INPROGRESS', 'REVIEW', '2PK', 'ENDORSEMENT', 'AWAITING', 'ATTENTION', 'HOLD', 'ON HOLD', 'SUBMITTED', 'OPEN'];
  const STATUS_BAD  = ['REJ', 'REJECTED', 'OVERDUE', 'CRITICAL', 'ESCALATED', 'EXPIRED', 'CANCELLED', 'CANCELED', 'FAILED', 'RETURNED', 'VOID'];
  const STATUS_INFO = ['RTC', 'REFERRED', 'NEW', 'REGISTERED', 'RECEIVED', 'ASSIGNED', 'ROUTED', 'DRAFT-ACTIVE'];
  const STATUS_NEUTRAL = ['DRAFT', 'ARCHIVED', 'INACTIVE', 'SUPERSEDED', 'OBSOLETE', 'WITHDRAWN'];
  function statusBucket(code) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return 'neutral';
    if (STATUS_GOOD.includes(c)) return 'good';
    if (STATUS_BAD.includes(c)) return 'bad';
    if (STATUS_WARN.includes(c)) return 'warn';
    if (STATUS_INFO.includes(c)) return 'info';
    if (STATUS_NEUTRAL.includes(c)) return 'neutral';
    return 'info';
  }
  /** Semantic status pill. Accepts a code string, or {code,name,color}. */
  function statusPill(v, label) {
    if (v == null || v === '') return el('span', { class: 'muted' }, '—');
    const code = typeof v === 'object' ? (v.code || v.name) : v;
    const text = label || (typeof v === 'object' ? (v.name || v.code) : v);
    return el('span', { class: 'badge st-' + statusBucket(code), title: text }, el('i', { class: 'dot' }), text || '—');
  }

  /* ---- breadcrumb ---- */
  /** items: [[label, href?], ...]  (last item is current, no link) */
  function breadcrumb(items) {
    const wrap = el('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' });
    items.forEach((it, i) => {
      const [label, href] = Array.isArray(it) ? it : [it, null];
      if (i) wrap.append(el('span', { class: 'sepc' }, '/'));
      if (href && i < items.length - 1) wrap.append(el('a', { href }, label));
      else wrap.append(el('span', { class: 'cur' }, label));
    });
    return wrap;
  }

  /* ---- page header ---- */
  function pageHeader({ title, desc, actions }) {
    return el('div', { class: 'page-head' },
      el('div', { class: 'ph-t' },
        el('h2', {}, title),
        desc ? el('div', { class: 'ph-d' }, desc) : null),
      actions && actions.length ? el('div', { class: 'ph-a' }, actions) : null);
  }

  /* ---- empty state ---- */
  function emptyState({ icon, title, message, actions } = {}) {
    return el('div', { class: 'empty-state' },
      el('div', { class: 'es-i' }, icon || '🗂'),
      title ? el('div', { class: 'es-t' }, title) : null,
      message ? el('div', { class: 'es-m' }, message) : null,
      actions && actions.length ? el('div', { class: 'es-a' }, actions) : null);
  }

  /* ---- skeleton loader ---- */
  function skeletonTable(cols = 6, rows = 6) {
    const wrap = el('div', { class: 'tblwrap' });
    for (let r = 0; r < rows; r++) {
      const row = el('div', { class: 'skel-row' });
      for (let c = 0; c < cols; c++) row.append(el('div', { class: 'skel', style: `width:${40 + (r * c + c * 17) % 55}%` }));
      wrap.append(row);
    }
    return wrap;
  }
  function skeletonCards(n = 4) {
    return el('div', { class: 'grid g4' },
      Array.from({ length: n }, () => el('div', { class: 'card', style: 'padding:16px' },
        el('div', { class: 'skel skel-line', style: 'width:40%;height:22px' }),
        el('div', { class: 'skel skel-line', style: 'width:70%' }))));
  }

  /* ---- drawer (side panel) ---- */
  function drawer(title, bodyEl, { actions = [], width } = {}) {
    const mask = el('div', { class: 'drawer-mask', onclick: () => close() });
    const foot = actions.length ? el('div', { class: 'mf' }, actions.map(a =>
      el('button', { class: `btn ${a.kind || ''}`, onclick: () => a.onClick(close) }, a.label))) : null;
    const panel = el('div', { class: 'drawer', style: width ? `width:${width}` : '', role: 'dialog', 'aria-modal': 'true' },
      el('div', { class: 'dh' }, title, el('span', { class: 'x', title: 'Close', onclick: () => close() }, '✕')),
      el('div', { class: 'db' }, bodyEl),
      foot);
    document.body.append(mask, panel);
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    function close() { mask.remove(); panel.remove(); document.removeEventListener('keydown', onKey); }
    return { close };
  }

  /* ---- confirm dialog ---- */
  function confirm(title, message, { confirmLabel = 'Confirm', danger = false, onConfirm } = {}) {
    const body = el('div', {}, typeof message === 'string' ? el('p', { style: 'margin:0;color:var(--ink-2)' }, message) : message);
    return modal(title, body, {
      actions: [
        { label: 'Cancel', onClick: c => c() },
        { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: async c => { try { await (onConfirm && onConfirm()); c(); } catch (e) { toast(e.message, 'err'); } } }
      ]
    });
  }

  /* ---- workflow stepper ---- */
  /** steps: [{label, meta?, state:'done'|'current'|'rej'|'todo'}] */
  function stepper(steps) {
    return el('div', { class: 'stepper' }, steps.map((s, i) => {
      const state = s.state || 'todo';
      const mark = state === 'done' ? '✓' : state === 'rej' ? '✕' : String(i + 1);
      return el('div', { class: 'step ' + state },
        el('div', { class: 'sdot' }, mark),
        el('div', { class: 'st' }, s.label),
        s.meta ? el('div', { class: 'sm' }, s.meta) : null);
    }));
  }

  /* ---- row "more" menu ---- */
  /** items: [{label, icon?, onClick, danger?}] or {sep:true} */
  function moreMenu(items, { label = '⋯', primary } = {}) {
    const wrap = el('div', { class: 'moremenu' });
    const btn = el('button', { class: 'btn sm', title: 'More actions', 'aria-haspopup': 'true' }, label);
    let open = null;
    function closeMenu() { if (open) { open.remove(); open = null; document.removeEventListener('click', outside, true); } }
    function outside(e) { if (!wrap.contains(e.target)) closeMenu(); }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (open) return closeMenu();
      const menu = el('div', { class: 'menu' }, items.map(it => {
        if (it.sep) return el('div', { class: 'sep' });
        return el('button', { class: it.danger ? 'danger' : '', onclick: (ev) => { ev.stopPropagation(); closeMenu(); it.onClick && it.onClick(); } },
          it.icon ? el('span', {}, it.icon) : null, it.label);
      }));
      wrap.append(menu); open = menu;
      setTimeout(() => document.addEventListener('click', outside, true), 0);
    });
    if (primary) wrap.append(primary);
    wrap.append(btn);
    return wrap;
  }

  const fmtBytes = (n) => {
    if (n == null) return '—';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; n = Number(n);
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
  };

  // Expose toolkit as window globals too — page modules use bare `el`, `badge`, etc.
  Object.assign(window, {
    el, fmtDate, fmtDT, badge, toast, modal, table, pager,
    field, input, select: selectEl, textarea: textareaEl,
    donut, bars, legend, downloadFile,
    statusBucket, statusPill, breadcrumb, pageHeader, emptyState,
    skeletonTable, skeletonCards, drawer, stepper, moreMenu, fmtBytes
  });

  return {
    el, fmtDate, fmtDT, badge, toast, modal, table, pager, field, input, select: selectEl, textarea: textareaEl,
    donut, bars, legend, downloadFile,
    statusBucket, statusPill, breadcrumb, pageHeader, emptyState,
    skeletonTable, skeletonCards, drawer, confirm, stepper, moreMenu, fmtBytes
  };
})();
