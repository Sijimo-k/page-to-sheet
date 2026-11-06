/**
 * Page to Sheet - receiver for your own Google Sheet.
 *
 * Setup (once):
 * 1. Open the Google Sheet you want to fill. Extensions > Apps Script. Paste this file.
 * 2. Project Settings > Script properties > add TOKEN = a long random string.
 * 3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 4. Copy the web app URL (ends in /exec) and the same TOKEN into the extension's Settings.
 *
 * The script only appends rows to this spreadsheet and skips rows whose key columns
 * already exist in the target tab. Requests without the right token are rejected.
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!expected) return json_({ ok: false, error: 'TOKEN script property is not set' });
    if (body.token !== expected) return json_({ ok: false, error: 'wrong token' });

    const columns = validColumns_(body.columns);
    const keyColumns = (body.keyColumns || []).filter(function (k) { return columns.indexOf(k) >= 0; });
    const keys = keyColumns.length ? keyColumns : columns;
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];

    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try {
      const sheet = sheetFor_(String(body.sheetName || 'Page to Sheet').slice(0, 90), columns);
      const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
      const keyIdx = keys.map(function (k) { return header.indexOf(k); });

      const seen = {};
      if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, header.length).getDisplayValues().forEach(function (r) {
          seen[keyOf_(keyIdx.map(function (i) { return i >= 0 ? r[i] : ''; }))] = true;
        });
      }

      const out = [];
      let skipped = 0;
      rows.forEach(function (row) {
        const key = keyOf_(keys.map(function (k) { return row[k] || ''; }));
        if (key.replace(/␟/g, '') !== '' && seen[key]) { skipped++; return; }
        seen[key] = true;
        out.push(header.map(function (h) { return safe_(row[h]); }));
      });
      if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, header.length).setValues(out);
      return json_({ ok: true, appended: out.length, skipped: skipped });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function validColumns_(columns) {
  if (!Array.isArray(columns) || !columns.length) throw new Error('no columns');
  return columns.map(function (c) { return String(c).slice(0, 100); });
}

/** Create the tab with a header row, or add any missing columns to an existing one. */
function sheetFor_(name, columns) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  const width = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, width).getValues()[0].map(String).filter(function (h) { return h !== ''; });
  const missing = columns.filter(function (c) { return header.indexOf(c) < 0; });
  if (missing.length) sheet.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  return sheet;
}

function keyOf_(values) {
  return values.map(function (v) { return String(v).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase(); }).join('␟');
}

/** Store text as text so page content can never run as a formula. */
function safe_(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
