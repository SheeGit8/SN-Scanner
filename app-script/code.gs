/**
 * Sheehan IT Stock Scanner — Apps Script backend (the app's database)
 *
 * A Google Sheet holds the stock list that every phone and computer shares. The app is hosted on
 * Vercel and reaches this script only through its own server (api/gas.js), which adds the sync token:
 *
 *   Phone / PC ──app password──▶ Vercel /api/gas ──sync token──▶ doPost (this file) ──▶ Sheet + Drive
 *
 * How to install (details in README.md):
 *   1. Open the Google Sheet > Extensions > Apps Script, and paste this whole file into Code.gs.
 *   2. Pick `generateSyncToken` in the function list and press Run. Copy the token from the
 *      execution log (or type your own long secret into SYNC_TOKEN below instead).
 *   3. Pick `setup` and press Run once. Approve the permissions. It creates the "Items" sheet and
 *      the Drive folder for label photos. Running it again is safe.
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 *      Copy the URL ending in /exec. In Vercel, set GAS_URL (that URL), SYNC_TOKEN and APP_PASSWORD.
 *   After pasting a newer version of this file: Deploy > Manage deployments > Edit > New version.
 *
 * Sheet "Items": one row per item, newest at the bottom. People can read it, sort it, filter it and
 * edit cells by hand; the app picks the changes up within a minute. Columns are found by their
 * header, so they can be moved. A row typed in by hand gets an ID the next time the app loads.
 *
 * Label photos are JPEG files in the Drive folder "Sheehan IT Stock Photos". The Photo column links
 * to them. Deleting an item in the app moves its photo to the Drive trash (kept 30 days).
 */

/* ================================================================== */
/* YOUR SETTINGS: fill these in inside the Apps Script editor only.    */
/* Don't commit the filled-in values to GitHub.                        */
/* ================================================================== */

/** Same value as SYNC_TOKEN in Vercel. Leave '' and run generateSyncToken to keep it in Script Properties instead. */
const SYNC_TOKEN = '';

/**
 * Link to the Google Sheet used as the database, e.g. 'https://docs.google.com/spreadsheets/d/1AbC...xyz/edit'.
 * Can stay '' when this script was opened from the sheet (Extensions > Apps Script).
 */
const SPREADSHEET_URL = '';

/* ================================================================== */

const CONFIG = {
  ITEMS_SHEET: 'Items',
  PHOTO_FOLDER_NAME: 'Sheehan IT Stock Photos',
  FOLDER_PROPERTY: 'PHOTO_FOLDER_ID',
  SYNC_TOKEN_PROPERTY: 'SYNC_TOKEN',
  SPREADSHEET_PROPERTY: 'SPREADSHEET_URL',
  HEADER_BG: '#C8102E', // Sheehan red
  HEADER_FG: '#FFFFFF',
  DATE_FORMAT: 'yyyy-mm-dd hh:mm',
  MAX_OPS: 200, // changes per request; the app sends at most 100
  MAX_UPLOAD_CHARS: 4 * 1024 * 1024, // Vercel takes at most 4.5 MB per request; the app sends 150 to 300 KB
};

/** [key, header]. Same order as the app's CSV export, then the columns only the sheet has. */
const ITEM_FIELDS = [
  ['serial', 'Serial number'],
  ['name', 'Name'],
  ['user', 'User'],
  ['model', 'Model'],
  ['color', 'Color'],
  ['location', 'Location'],
  ['note', 'Note'],
  ['source', 'Method'],
  ['scannedAt', 'Scanned at'],
  ['photo', 'Photo'],
  ['updatedAt', 'Updated at'],
  ['id', 'ID'],
];
const DATE_KEYS_ = ['scannedAt', 'updatedAt'];
const WIDTHS_ = { serial: 150, name: 200, user: 170, model: 140, color: 90, location: 170, note: 240, source: 80, scannedAt: 130, photo: 120, updatedAt: 130, id: 130 };

/** Fields the app may set on a new item, and the ones it may change later. */
const ADD_KEYS_ = ['serial', 'name', 'user', 'model', 'color', 'location', 'note', 'source', 'scannedAt'];
const EDIT_KEYS_ = ['serial', 'name', 'user', 'model', 'color', 'location', 'note'];

/** How the item was added: app value <-> what the Method column shows. */
const SOURCES_ = { camera: 'Camera', photo: 'Photo', manual: 'Typed' };

/* ------------------------------------------------------------------ */
/* Web app entry                                                       */
/* ------------------------------------------------------------------ */

function doGet() {
  return ContentService.createTextOutput(syncToken_()
    ? 'Sheehan IT Stock Scanner API is running. Open the app on Vercel.'
    : 'Sheehan IT Stock Scanner API: no sync token yet. Run generateSyncToken in the Apps Script editor.');
}

/** Functions the Vercel server may call. Anything else is refused. */
const REMOTE_API_ = {
  getItems: getItems,
  getVersion: getVersion,
  applyChanges: applyChanges,
  uploadPhoto: uploadPhoto,
  getPhoto: getPhoto,
};

/**
 * JSON API used by the Vercel server (api/gas.js).
 * Request body: {"token": "<sync token>", "fn": "getItems", "args": []}
 * Response: {"ok": true, "result": ...} or {"ok": false, "error": "...", "status": 400 | 401 | 503}
 */
function doPost(e) {
  let out;
  try {
    const expected = syncToken_();
    if (!expected) throw httpError_(503, 'No sync token yet. Run generateSyncToken in the Apps Script editor.');
    let req;
    try {
      req = JSON.parse((e && e.postData && e.postData.contents) || '');
    } catch (err) {
      throw httpError_(400, 'The request body is not JSON.');
    }
    if (!sameText_(String(req.token || ''), expected)) throw httpError_(401, 'Wrong sync token.');
    const fn = Object.prototype.hasOwnProperty.call(REMOTE_API_, req.fn) ? REMOTE_API_[req.fn] : null;
    if (!fn) throw httpError_(400, 'Unknown function: ' + req.fn);
    out = { ok: true, result: fn.apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    out = { ok: false, error: err && err.message ? err.message : String(err), status: (err && err.status) || 400 };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function httpError_(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Compares two strings without stopping at the first difference. */
function sameText_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Run these from the editor                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates (or replaces) the sync token and prints it in the execution log. Copy it into Vercel
 * as SYNC_TOKEN. Running it again makes the old token stop working.
 */
function generateSyncToken() {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(CONFIG.SYNC_TOKEN_PROPERTY, token);
  Logger.log('SYNC_TOKEN (paste into Vercel > Settings > Environment Variables):\n' + token);
  if (String(SYNC_TOKEN).trim()) Logger.log('Note: SYNC_TOKEN at the top of Code.gs is filled in, so that one is used instead.');
  return token;
}

/** Switches Vercel access off: the app can no longer read or write the sheet. */
function removeSyncToken() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.SYNC_TOKEN_PROPERTY);
  Logger.log(String(SYNC_TOKEN).trim()
    ? 'Script Property removed, but SYNC_TOKEN at the top of Code.gs is still filled in. Empty it too.'
    : 'Sync token removed. The app can no longer reach this sheet.');
}

/** Creates the "Items" sheet and the photo folder. Safe to run again: it never touches existing rows. */
function setup() {
  const sh = itemsSheet_();
  const folder = photoFolder_();
  Logger.log('Setup complete.\nSheet: ' + spreadsheet_().getUrl() + '#gid=' + sh.getSheetId() + '\nPhotos folder: ' + folder.getUrl());
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Every item, plus a `version` of the whole list. Rows typed into the sheet by hand get an ID
 * (and a scan time, if theirs is missing) so the app can edit them.
 */
function getItems() {
  let t = table_();
  if (t.rows.some(function (r) { return needsRepair_(t, r); })) {
    t = withLock_(function () {
      const fresh = table_();
      repairRows_(fresh);
      SpreadsheetApp.flush();
      return table_();
    });
  }
  return { items: t.rows.map(function (r) { return itemFromRow_(t, r); }), version: version_(t) };
}

/** A short hash of the list. The app asks for it every minute and reloads only when it changes. */
function getVersion() {
  return version_(table_());
}

/**
 * Applies the app's queued changes in order and returns the new list. Each change can be sent
 * twice without harm (the app retries after a lost connection):
 *   {op: 'add', id, item}     adds the item, or updates it when the ID is already there
 *   {op: 'update', id, patch} changes only the fields in `patch`; skipped when the item is gone
 *   {op: 'delete', id}        removes the row and moves its photo to the Drive trash
 * Returns { items, version, skipped: [ids of changes that couldn't be applied] }.
 */
function applyChanges(ops) {
  if (!Array.isArray(ops)) throw new Error('Send the changes as a list.');
  if (ops.length > CONFIG.MAX_OPS) throw new Error('Too many changes at once. Send at most ' + CONFIG.MAX_OPS + '.');

  return withLock_(function () {
    const t = table_();
    const byId = {};
    t.rows.forEach(function (r) {
      const id = text_(cell_(t, r, 'id'));
      if (id) byId[id] = r;
    });
    const now = new Date();
    const added = [];
    const skipped = [];
    const trash = [];

    ops.forEach(function (o) {
      const id = cleanId_(o && o.id);
      const r = id ? byId[id] : null;
      if (!id || !o) {
        skipped.push(String(o && o.id));
      } else if (o.op === 'add') {
        if (r) {
          setFields_(t, r, o.item || {}, ADD_KEYS_, now);
        } else {
          const nr = { values: blankRow_(t.width), formulas: [], isNew: true };
          setCell_(t, nr, 'id', id);
          setCell_(t, nr, 'source', SOURCES_.manual);
          setCell_(t, nr, 'scannedAt', now);
          setFields_(t, nr, o.item || {}, ADD_KEYS_, now);
          byId[id] = nr;
          added.push(nr);
        }
      } else if (o.op === 'update') {
        if (r) setFields_(t, r, o.patch || {}, EDIT_KEYS_, now);
        else skipped.push(id);
      } else if (o.op === 'delete') {
        if (!r) return; // already gone
        r.removed = true;
        const photoId = photoIdFrom_(cell_(t, r, 'photo'));
        if (photoId) trash.push(photoId);
        delete byId[id];
      } else {
        skipped.push(id);
      }
    });

    // 1. Rewrite changed rows, 2. append new ones, 3. delete from the bottom up so row numbers stay right.
    t.rows.forEach(function (r) {
      if (r.dirty && !r.removed) t.sh.getRange(r.rowNum, 1, 1, t.width).setValues([rowOut_(r)]);
    });
    appendRows_(t, added.filter(function (r) { return !r.removed; }));
    deleteRows_(t.sh, t.rows.filter(function (r) { return r.removed; }).map(function (r) { return r.rowNum; }));
    SpreadsheetApp.flush();

    trash.forEach(function (photoId) {
      try {
        photoFile_(photoId).setTrashed(true);
      } catch (e) {
        // already gone, or moved out of the folder by hand: nothing to clean up
      }
    });

    const after = table_();
    return {
      items: after.rows.map(function (r) { return itemFromRow_(after, r); }),
      version: version_(after),
      skipped: skipped,
    };
  });
}

/**
 * Saves a label photo for an item: payload { id, dataUrl }. The file goes into the photos folder
 * and the item's Photo cell links to it; an older photo moves to the Drive trash.
 * Returns { photoId }, or { photoId: null } when the item was deleted in the meantime.
 */
function uploadPhoto(payload) {
  const id = cleanId_(payload && payload.id);
  const dataUrl = String((payload && payload.dataUrl) || '');
  if (!id) throw new Error('Say which item the photo belongs to.');
  if (dataUrl.length > CONFIG.MAX_UPLOAD_CHARS) throw new Error('That photo is too large.');
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error('That file is not a JPEG, PNG or WebP image.');

  return withLock_(function () {
    const t = table_();
    const r = t.rows.filter(function (row) { return text_(cell_(t, row, 'id')) === id; })[0];
    if (!r) return { photoId: null };

    const label = (text_(cell_(t, r, 'serial')) || text_(cell_(t, r, 'name')) || id).replace(/[^\w .-]/g, '').slice(0, 60);
    const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
    const file = photoFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], label + ' (' + id + ').' + ext));
    file.setDescription('Label photo for ' + label + ', item ' + id);

    const old = photoIdFrom_(cell_(t, r, 'photo'));
    setCell_(t, r, 'photo', driveLink_(file.getId()));
    setCell_(t, r, 'updatedAt', new Date());
    t.sh.getRange(r.rowNum, 1, 1, t.width).setValues([rowOut_(r)]);
    if (old && old !== file.getId()) {
      try {
        photoFile_(old).setTrashed(true);
      } catch (e) {
        // the old file is already gone
      }
    }
    return { photoId: file.getId() };
  });
}

/** A label photo as a data URL, so the files can stay private in Drive. */
function getPhoto(photoId) {
  const blob = photoFile_(photoId).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/* ------------------------------------------------------------------ */
/* The "Items" sheet                                                   */
/* ------------------------------------------------------------------ */

/**
 * The sheet used as the database: SPREADSHEET_URL at the top of this file, else the Script Property
 * SPREADSHEET_URL, else the sheet this script was opened from.
 */
function spreadsheet_() {
  const setting = String(SPREADSHEET_URL || '').trim() ||
    PropertiesService.getScriptProperties().getProperty(CONFIG.SPREADSHEET_PROPERTY);
  if (setting) {
    const m = /\/d\/([\w-]{20,})/.exec(setting);
    return SpreadsheetApp.openById(m ? m[1] : setting.trim());
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('No spreadsheet linked. Paste the sheet\'s link into SPREADSHEET_URL at the top of Code.gs and deploy a new version.');
  }
  return active;
}

/** SYNC_TOKEN at the top of this file, else the one made by generateSyncToken. */
function syncToken_() {
  // Trimmed, so a space or line break picked up while pasting the token doesn't break it.
  return String(SYNC_TOKEN || '').trim() ||
    String(PropertiesService.getScriptProperties().getProperty(CONFIG.SYNC_TOKEN_PROPERTY) || '').trim();
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * The "Items" sheet, created with a red header row the first time. Headers the sheet is missing
 * (from an older version of this script) are added at the end.
 */
function itemsSheet_() {
  const ss = spreadsheet_();
  let sh = ss.getSheetByName(CONFIG.ITEMS_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.ITEMS_SHEET);

  if (sh.getLastRow() === 0) {
    writeHeaders_(sh, 1, ITEM_FIELDS);
    sh.setFrozenRows(1);
    formatColumns_(sh, ITEM_FIELDS.map(function (f, i) { return { key: f[0], col: i + 1 }; }), 2, Math.max(sh.getMaxRows() - 1, 1));
    ITEM_FIELDS.forEach(function (f, i) { sh.setColumnWidth(i + 1, WIDTHS_[f[0]] || 120); });
    return sh;
  }

  const headers = headerRow_(sh);
  const missing = ITEM_FIELDS.filter(function (f) { return headers.indexOf(f[1]) === -1; });
  if (missing.length) {
    const first = sh.getLastColumn() + 1;
    if (sh.getMaxColumns() < first + missing.length - 1) {
      sh.insertColumnsAfter(sh.getMaxColumns(), first + missing.length - 1 - sh.getMaxColumns());
    }
    writeHeaders_(sh, first, missing);
    formatColumns_(sh, missing.map(function (f, i) { return { key: f[0], col: first + i }; }), 2, Math.max(sh.getMaxRows() - 1, 1));
  }
  return sh;
}

function writeHeaders_(sh, firstCol, fields) {
  sh.getRange(1, firstCol, 1, fields.length)
    .setValues([fields.map(function (f) { return f[1]; })])
    .setFontWeight('bold')
    .setBackground(CONFIG.HEADER_BG)
    .setFontColor(CONFIG.HEADER_FG);
}

/** Text columns stay plain text (so a serial like 00123 keeps its zeros); the two times are dates. */
function formatColumns_(sh, cols, firstRow, numRows) {
  cols.forEach(function (c) {
    sh.getRange(firstRow, c.col, numRows, 1).setNumberFormat(DATE_KEYS_.indexOf(c.key) >= 0 ? CONFIG.DATE_FORMAT : '@');
  });
}

function headerRow_(sh) {
  const width = sh.getLastColumn();
  if (!width) return [];
  return sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
}

/**
 * Reads the sheet: { sh, col: {key: 0-based column}, width, rows: [{rowNum, values, formulas}] }.
 * Rows where every app column is blank are left out.
 */
function table_() {
  const sh = itemsSheet_();
  const headers = headerRow_(sh);
  const col = {};
  ITEM_FIELDS.forEach(function (f) { col[f[0]] = headers.indexOf(f[1]); });
  const width = headers.length;
  const count = sh.getLastRow() - 1;
  const rows = [];
  if (count > 0) {
    const range = sh.getRange(2, 1, count, width);
    const values = range.getValues();
    const formulas = range.getFormulas();
    values.forEach(function (v, i) {
      const row = { rowNum: i + 2, values: v, formulas: formulas[i] };
      const blank = ITEM_FIELDS.every(function (f) { return v[col[f[0]]] === '' || v[col[f[0]]] === null; });
      if (!blank) rows.push(row);
    });
  }
  return { sh: sh, col: col, width: width, rows: rows };
}

function cell_(t, r, key) {
  return r.values[t.col[key]];
}

function setCell_(t, r, key, value) {
  r.values[t.col[key]] = value;
  if (r.formulas) r.formulas[t.col[key]] = '';
  r.dirty = true;
}

/** Copies the allowed fields of `obj` into row `r` and stamps Updated at. */
function setFields_(t, r, obj, keys, now) {
  keys.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) return;
    let v = obj[key];
    if (key === 'source') v = SOURCES_[v] || SOURCES_.manual;
    else if (key === 'scannedAt') v = parseDate_(v) || now;
    else v = String(v === null || v === undefined ? '' : v).trim().slice(0, 500);
    setCell_(t, r, key, v);
  });
  setCell_(t, r, 'updatedAt', now);
}

/** A row ready for setValues: formulas typed in by hand stay formulas; text that would turn into one doesn't. */
function rowOut_(r) {
  return r.values.map(function (v, i) {
    const f = r.formulas && r.formulas[i];
    if (f) return f;
    return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v;
  });
}

function blankRow_(width) {
  const row = [];
  for (let i = 0; i < width; i++) row.push('');
  return row;
}

function appendRows_(t, rows) {
  if (!rows.length) return;
  const sh = t.sh;
  const start = sh.getLastRow() + 1;
  const end = start + rows.length - 1;
  if (sh.getMaxRows() < end) sh.insertRowsAfter(sh.getMaxRows(), end - sh.getMaxRows());
  // New rows get the column formats first, so values like 00123 aren't turned into numbers.
  formatColumns_(sh, ITEM_FIELDS.map(function (f) { return { key: f[0], col: t.col[f[0]] + 1 }; }), start, rows.length);
  sh.getRange(start, 1, rows.length, t.width).setValues(rows.map(rowOut_));
}

/**
 * Deletes rows from the bottom up, joining neighbours into one call. Keeps one empty row,
 * because a sheet can't lose all its unfrozen rows.
 */
function deleteRows_(sh, rowNums) {
  if (!rowNums.length) return;
  if (sh.getMaxRows() - rowNums.length <= sh.getFrozenRows()) sh.insertRowsAfter(sh.getMaxRows(), 1);
  const nums = rowNums.slice().sort(function (a, b) { return b - a; });
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] - 1) j++;
    sh.deleteRows(nums[j], j - i + 1); // nums[j] is the top row of this run
    i = j + 1;
  }
}

/** A row typed in by hand: no ID yet, no usable scan time, or no method. */
function needsRepair_(t, r) {
  return !text_(cell_(t, r, 'id')) || !parseDate_(cell_(t, r, 'scannedAt')) || !text_(cell_(t, r, 'source'));
}

function repairRows_(t) {
  const now = new Date();
  t.rows.forEach(function (r) {
    const changes = {};
    if (!text_(cell_(t, r, 'id'))) changes.id = newId_();
    if (!parseDate_(cell_(t, r, 'scannedAt'))) changes.scannedAt = now;
    if (!text_(cell_(t, r, 'source'))) changes.source = SOURCES_.manual;
    const keys = Object.keys(changes);
    if (!keys.length) return;
    keys.forEach(function (k) { setCell_(t, r, k, changes[k]); });
    setCell_(t, r, 'updatedAt', now);
    t.sh.getRange(r.rowNum, 1, 1, t.width).setValues([rowOut_(r)]);
  });
}

/* ---------- Values ---------- */

function itemFromRow_(t, r) {
  const photoId = photoIdFrom_(cell_(t, r, 'photo'));
  const item = { id: text_(cell_(t, r, 'id')) };
  EDIT_KEYS_.forEach(function (k) { item[k] = text_(cell_(t, r, k)); });
  item.source = sourceKey_(cell_(t, r, 'source'));
  item.scannedAt = isoOrEmpty_(cell_(t, r, 'scannedAt'));
  item.updatedAt = isoOrEmpty_(cell_(t, r, 'updatedAt'));
  item.photoId = photoId;
  item.hasPhoto = !!photoId;
  return item;
}

/** Version of the list: changes on any edit, including edits typed into the sheet. */
function version_(t) {
  return hash_(t.rows.map(function (r) {
    return ITEM_FIELDS.map(function (f) {
      const v = cell_(t, r, f[0]);
      return v instanceof Date ? v.getTime() : v;
    });
  }));
}

function hash_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(value), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '').slice(0, 16);
}

/** Cell value as trimmed text. Dates typed into text columns come back as yyyy-MM-dd. */
function text_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Manila', 'yyyy-MM-dd');
  return v === null || v === undefined ? '' : String(v).trim();
}

function parseDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v === null || v === undefined ? '' : v).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isoOrEmpty_(v) {
  const d = parseDate_(v);
  return d ? d.toISOString() : '';
}

function sourceKey_(v) {
  const s = text_(v).toLowerCase();
  for (const key in SOURCES_) {
    if (s === key || s === SOURCES_[key].toLowerCase()) return key;
  }
  return 'manual';
}

/** IDs come from the app (letters and digits). Anything else is refused. */
function cleanId_(v) {
  const s = String(v === null || v === undefined ? '' : v).trim();
  return /^[\w-]{4,64}$/.test(s) ? s : '';
}

function newId_() {
  return 'h' + Utilities.getUuid().replace(/-/g, '').slice(0, 15);
}

/* ---------- Photos in Drive ---------- */

function driveLink_(fileId) {
  return 'https://drive.google.com/file/d/' + fileId + '/view';
}

/** The Drive file id in a Photo cell (a link or a bare id). */
function photoIdFrom_(v) {
  const s = text_(v);
  if (!s) return '';
  const m = /\/d\/([\w-]{10,})/.exec(s) || /[?&]id=([\w-]{10,})/.exec(s) || /^([\w-]{10,})$/.exec(s);
  return m ? m[1] : '';
}

function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(CONFIG.FOLDER_PROPERTY);
  if (id) {
    try {
      const existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (e) {
      // the folder was deleted; make a new one below
    }
  }
  const folder = DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
  props.setProperty(CONFIG.FOLDER_PROPERTY, folder.getId());
  return folder;
}

/** Only files inside the photos folder can be read or trashed through the app. */
function photoFile_(fileId) {
  if (!/^[\w-]{10,}$/.test(String(fileId || ''))) throw new Error('Unknown photo.');
  const folderId = photoFolder_().getId();
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return file;
  }
  throw new Error('That file is not in the stock photos folder.');
}
