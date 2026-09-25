'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { audit } = require('./audit');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function toCsv(columns, rows) {
  const q1 = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const head = columns.map(c => q1(c.label)).join(',');
  const lines = rows.map(r => columns.map(c => q1(r[c.key])).join(','));
  return '\ufeff' + [head, ...lines].join('\r\n');
}

/** SpreadsheetML 2003 — opens natively in Microsoft Excel. */
function toExcelXml(columns, rows, sheetName = 'Export') {
  const cell = v => {
    const isNum = v != null && v !== '' && !isNaN(v) && typeof v !== 'boolean';
    return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`;
  };
  const head = `<Row>${columns.map(c => `<Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('')}</Row>`;
  const body = rows.map(r => `<Row>${columns.map(c => cell(r[c.key])).join('')}</Row>`).join('\n');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>
 <Worksheet ss:Name="${esc(sheetName).slice(0, 30)}"><Table>
 <Row>${columns.map(c => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('')}</Row>
 ${body}
 </Table></Worksheet></Workbook>`;
}

function toPrintableHtml(title, columns, rows) {
  const head = columns.map(c => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.map(r => `<tr>${columns.map(c => `<td>${esc(r[c.key])}</td>`).join('')}</tr>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#111}h1{font-size:16px}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}
th{background:#eef2f7}tr:nth-child(even){background:#fafafa}@media print{.noprint{display:none}}</style>
</head><body><h1>${esc(title)}</h1><p class=noprint>Use your browser Print &rarr; Save as PDF.</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

/**
 * Build an export file for a result set. Returns {filename, mime, path}.
 * format: csv | excel | pdf (printable HTML)
 */
function exportResultSet({ format, title, columns, rows, user }) {
  fs.mkdirSync(config.exportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  let filename, content, mime;
  if (format === 'excel' || format === 'xlsx') {
    filename = `${title.replace(/[^\w]+/g, '_')}-${stamp}.xls`;
    content = toExcelXml(columns, rows, title.slice(0, 28));
    mime = 'application/vnd.ms-excel';
  } else if (format === 'pdf') {
    filename = `${title.replace(/[^\w]+/g, '_')}-${stamp}.html`;
    content = toPrintableHtml(title, columns, rows);
    mime = 'text/html';
  } else {
    filename = `${title.replace(/[^\w]+/g, '_')}-${stamp}.csv`;
    content = toCsv(columns, rows);
    mime = 'text/csv';
  }
  const abs = path.join(config.exportDir, filename);
  fs.writeFileSync(abs, content);
  audit({
    user, action: 'EXPORT', entityType: 'REPORT', entityId: null,
    details: JSON.stringify({ title, format, rows: rows.length })
  });
  return { filename, mime, path: abs };
}

module.exports = { exportResultSet, toCsv };
