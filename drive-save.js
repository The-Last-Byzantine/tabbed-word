/* Google Drive: save, open, and automatic sync (no sharing).
   Google's sign-in script loads only when a Drive button is pressed or a sync needs it.
   Edits always save on this device first. A linked document is uploaded to Drive after
   the person pauses typing; while offline, changed documents wait and upload on reconnect.
   The browser talks to Google directly; nothing passes through a Tabbed Word server.
   Tokens stay in memory only. Drive links and "changed, not yet uploaded" flags are stored
   on each document, so they survive a reload. */
(function () {
  'use strict';
  var CLIENT_ID = '1030444770738-0r8vo12bf77lof26jifk31bq1qu7gll1.apps.googleusercontent.com';
  var SCOPE = 'https://www.googleapis.com/auth/drive';
  var GIS_URL = 'https://accounts.google.com/gsi/client';
  var FILES = 'https://www.googleapis.com/drive/v3/files';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  var OPEN_MIMES = [DOCX, 'application/vnd.oasis.opendocument.text', 'application/msword',
                    'text/plain', 'text/markdown', 'text/html'];
  var OPEN_EXT = /\.(docx|odt|doc|txt|md|markdown|html?)$/i;
  var IDLE_MS = 3000;       /* no typing for this long before a sync starts */
  var DEBOUNCE_MS = 4000;   /* wait this long after the last change */
  var RETRY_MS = 30000;

  var token = null, tokenExpires = 0, tokenClient = null, pending = null, loading = null;
  var quiet = false;        /* true while the app itself switches or saves: not an edit */
  var working = false;      /* true during a background sync */
  var busy = false, signinNeeded = false, timer = null, lastKey = 0;
  var editSeq = {};         /* document id -> counter, bumped on every edit */
  var stateEl = null;

  function report(msg) {
    var s = document.getElementById('status');
    if (s) s.textContent = msg;
  }

  function httpError(r) {
    var e = new Error('Google Drive answered with status ' + r.status + '.');
    e.status = r.status;
    return e;
  }

  function gisReady() {
    return !!(window.google && google.accounts && google.accounts.oauth2);
  }

  function loadGis() {
    if (gisReady()) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = GIS_URL;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        loading = null;
        reject(new Error('Google sign-in could not be loaded. Check your internet connection.'));
      };
      document.head.appendChild(s);
    });
    return loading;
  }

  function ensureTokenClient() {
    if (tokenClient) return;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: function (resp) {
        var p = pending;
        pending = null;
        if (!p) return;
        if (resp.error) { p.reject(new Error('Google sign-in was not completed (' + resp.error + ').')); return; }
        token = resp.access_token;
        tokenExpires = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        signinNeeded = false;
        p.resolve(token);
      },
      error_callback: function (err) {
        var p = pending;
        pending = null;
        if (p) p.reject(new Error('The Google sign-in window was closed.' + (err && err.type ? ' (' + err.type + ')' : '')));
      }
    });
  }

  /* A click must call requestAccessToken synchronously, or browsers block the sign-in window.
     silent = true asks Google without a window; it fails when the person must choose. */
  function askToken(silent) {
    ensureTokenClient();
    return new Promise(function (resolve, reject) {
      pending = { resolve: resolve, reject: reject };
      tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
    });
  }

  function getToken(silent) {
    if (token && Date.now() < tokenExpires - 60000) return Promise.resolve(token);
    if (!gisReady()) return loadGis().then(function () { return askToken(silent); });
    return askToken(silent);
  }

  function upload(blob, fileName, mime, existingId, accessToken) {
    var boundary = 'twdrive' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    var meta = existingId ? { name: fileName } : { name: fileName, mimeType: mime };
    var body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(meta),
      '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n',
      blob,
      '\r\n--' + boundary + '--'
    ], { type: 'multipart/related; boundary=' + boundary });
    var url = UPLOAD + (existingId ? '/' + encodeURIComponent(existingId) : '') +
      '?uploadType=multipart&fields=id,name,modifiedTime';
    return fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: body
    }).then(function (r) { if (r.ok) return r.json(); throw httpError(r); });
  }

  function fileNameOf(d) {
    var info = formatInfo(d.kind);
    var n = d.name || d.title || info.defaultName;
    if (!/\.[a-z0-9]{2,5}$/i.test(n)) n += info.extensions[0];
    return n;
  }

  function timeLabel(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* Persist the document list without treating the write as an edit. */
  function persistQuiet() {
    if (typeof window.persistDrafts !== 'function') return;
    quiet = true;
    try { window.persistDrafts(); } catch (e) {} finally { quiet = false; }
  }

  function activeDocument() {
    return typeof activeDoc === 'function' ? activeDoc() : null;
  }

  function allDocs() {
    return typeof docs !== 'undefined' ? docs : [];
  }

  /* ---- bottom bar note ---- */

  function refresh() {
    if (!stateEl) return;
    var d = activeDocument();
    if (!d || !d.drive) { stateEl.textContent = ''; return; }
    var txt;
    if (d.driveConflict) txt = 'Drive has a newer version of this file · press Drive to keep this copy';
    else if (d.driveDirty && !navigator.onLine) txt = 'Offline · saved on this device, syncs when you are back online';
    else if (d.driveDirty && signinNeeded) txt = 'Press Drive to reconnect · changes are saved on this device';
    else if (d.driveDirty && d.driveError) txt = 'Not synced to Google Drive yet · will retry';
    else if (d.driveDirty) txt = busy ? 'Syncing to Google Drive…' : 'Changes waiting to sync to Google Drive';
    else txt = 'Synced to Google Drive' + (d.drive.at ? ' · ' + timeLabel(d.drive.at) : '');
    stateEl.textContent = txt;
  }

  function addStateElement() {
    var sb = document.getElementById('statusbar');
    if (!sb || document.getElementById('drivestate')) return;
    stateEl = document.createElement('span');
    stateEl.id = 'drivestate';
    stateEl.setAttribute('role', 'status');
    stateEl.style.cssText = 'font-weight:600;color:#1a2b4c;white-space:nowrap;padding:0 8px';
    sb.appendChild(stateEl);
  }

  /* ---- automatic sync ---- */

  function linkedDirty() {
    return allDocs().filter(function (d) { return d.drive && d.driveDirty && !d.driveConflict; });
  }

  function hasLinked() {
    return allDocs().some(function (d) { return d.drive; });
  }

  function markActiveEdited() {
    var d = activeDocument();
    if (!d || !d.drive) return;
    d.driveDirty = true;
    editSeq[d.id] = (editSeq[d.id] || 0) + 1;
  }

  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; runJob(); }, ms === undefined ? DEBOUNCE_MS : ms);
  }

  function setActive(id) {
    var a = activeDocument();
    if (a && a.id !== id) window.switchDoc(id);
  }

  /* Upload one document's exported blob, unless Drive has a newer version. */
  function pushDoc(d, blob, fileName, mime, t, mark) {
    return fetch(FILES + '/' + encodeURIComponent(d.drive.id) + '?fields=modifiedTime', {
      headers: { Authorization: 'Bearer ' + t }
    }).then(function (r) {
      if (r.status === 404) { d.drive = null; d.driveDirty = false; return; }
      if (!r.ok) throw httpError(r);
      return r.json().then(function (meta) {
        if (d.drive.rev && meta.modifiedTime !== d.drive.rev) { d.driveConflict = true; return; }
        return upload(blob, fileName, mime, d.drive.id, t).then(function (f) {
          d.drive.rev = f.modifiedTime;
          d.driveError = '';
          if ((editSeq[d.id] || 0) !== mark) return; /* edited while uploading: stays dirty */
          d.drive.at = Date.now();
          d.driveDirty = false;
          d.driveConflict = false;
        });
      });
    });
  }

  function syncList(list, t) {
    var a = activeDocument(), origId = a ? a.id : null, stopped = false;
    return list.reduce(function (p, d) {
      return p.then(function () {
        if (stopped) return;
        if (Date.now() - lastKey < IDLE_MS) { stopped = true; return; }
        if (!d.drive || !d.driveDirty || d.driveConflict) return;
        var mark = editSeq[d.id] || 0;
        setActive(d.id);
        syncDoc();
        var info = formatInfo(d.kind);
        return exportCurrent().then(function (blob) {
          return pushDoc(d, blob, fileNameOf(d), info.mime, t, mark);
        }).catch(function (e) {
          d.driveError = e.message;
          if (e.status === 401) { token = null; signinNeeded = true; }
        });
      });
    }, Promise.resolve()).then(function () {
      var cur = activeDocument();
      if (origId && cur && cur.id !== origId) setActive(origId);
      persistQuiet();
      return stopped;
    });
  }

  function runJob() {
    var list = linkedDirty();
    if (!list.length) { refresh(); return; }
    if (busy) { schedule(IDLE_MS); return; }
    if (!navigator.onLine) { refresh(); return; }
    var idle = Date.now() - lastKey;
    if (idle < IDLE_MS) { schedule(IDLE_MS - idle + 200); return; }
    busy = true;
    working = true;
    refresh();
    getToken(true).then(function (t) {
      signinNeeded = false;
      return syncList(list, t);
    }, function () {
      signinNeeded = true;
      return null;
    }).then(function (stopped) {
      busy = false;
      working = false;
      refresh();
      if (signinNeeded) return;           /* wait for a Drive press */
      if (linkedDirty().length) schedule(stopped ? IDLE_MS + 200 : RETRY_MS);
    }, function () {
      busy = false;
      working = false;
      refresh();
      schedule(RETRY_MS);
    });
  }

  function install() {
    var origPersist = window.persistDrafts, origSwitch = window.switchDoc;
    if (typeof origPersist === 'function') {
      window.persistDrafts = function () {
        var edit = !quiet && !working;
        if (edit) markActiveEdited();
        var r = origPersist.apply(this, arguments);
        if (edit && hasLinked()) { refresh(); schedule(DEBOUNCE_MS); }
        return r;
      };
    }
    if (typeof origSwitch === 'function') {
      window.switchDoc = function () {
        var was = quiet;
        quiet = true;
        try { return origSwitch.apply(this, arguments); }
        finally {
          quiet = was;
          refresh();
          if (!working && hasLinked()) schedule(DEBOUNCE_MS);
        }
      };
    }
    ['keydown', 'input'].forEach(function (type) {
      document.addEventListener(type, function () { lastKey = Date.now(); }, true);
    });
    window.addEventListener('online', function () { refresh(); schedule(1000); });
    window.addEventListener('offline', refresh);
    addStateElement();
    refresh();
    if (linkedDirty().length) schedule(DEBOUNCE_MS);
  }

  /* ---- Save to Drive (button) ---- */

  function saveDoc(d, blob, fileName, mime) {
    return getToken().then(function (t) {
      var existing = d.drive ? d.drive.id : null;
      return upload(blob, fileName, mime, existing, t).catch(function (e) {
        if (e.status === 401) { token = null; throw new Error('The sign-in has expired. Press Google Drive again.'); }
        if (existing && e.status === 404) { d.drive = null; return upload(blob, fileName, mime, null, t); }
        throw e;
      });
    }).then(function (f) {
      d.drive = { id: f.id, rev: f.modifiedTime, at: Date.now() };
      d.driveDirty = false;
      d.driveConflict = false;
      d.driveError = '';
      persistQuiet();
      return { ok: true, name: f.name };
    });
  }

  /* Used by Email all: every open tab becomes a new Drive file, one after another. */
  function uploadAll(files) {
    return files.reduce(function (p, f) {
      return p.then(function () {
        return getToken().then(function (t) {
          return upload(f.blob, f.name, f.blob.type || DOCX, null, t);
        });
      });
    }, Promise.resolve());
  }

  /* ---- Open from Drive ---- */

  function listFiles(t) {
    var q = 'trashed=false and (' + OPEN_MIMES.map(function (m) { return "mimeType='" + m + "'"; }).join(' or ') + ')';
    var url = FILES + '?' + new URLSearchParams({
      q: q, orderBy: 'modifiedTime desc', pageSize: '100', fields: 'files(id,name,mimeType,modifiedTime)'
    });
    return fetch(url, { headers: { Authorization: 'Bearer ' + t } }).then(function (r) {
      if (!r.ok) throw httpError(r);
      return r.json();
    }).then(function (j) {
      return (j.files || []).filter(function (f) { return OPEN_EXT.test(f.name); });
    });
  }

  var dlg = null;
  function showList(files) {
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'drive-open';
      dlg.setAttribute('aria-labelledby', 'drive-open-title');
      dlg.innerHTML = '<h2 id="drive-open-title">Open from Google Drive</h2>' +
        '<p id="drive-open-msg" style="margin:0 0 8px"></p>' +
        '<ul id="drive-open-list" style="list-style:none;margin:0;padding:0;max-height:55vh;overflow:auto"></ul>' +
        '<p style="text-align:right;margin:12px 0 0"><button type="button" id="drive-open-cancel">Cancel</button></p>';
      document.body.appendChild(dlg);
      dlg.querySelector('#drive-open-cancel').addEventListener('click', function () { dlg.close(); });
    }
    var list = dlg.querySelector('#drive-open-list');
    list.textContent = '';
    dlg.querySelector('#drive-open-msg').textContent = files.length
      ? 'Choose a file. Only that file is downloaded to Tabbed Word.'
      : 'No Word, ODT, text or Markdown files were found in your Drive.';
    files.forEach(function (f) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = f.name + '  ·  ' + new Date(f.modifiedTime).toLocaleDateString();
      b.addEventListener('click', function () { dlg.close(); openDriveFile(f); });
      li.appendChild(b);
      list.appendChild(li);
    });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function openDriveFile(f) {
    report('Opening ' + f.name + ' from Google Drive…');
    getToken().then(function (t) {
      return fetch(FILES + '/' + encodeURIComponent(f.id) + '?alt=media', { headers: { Authorization: 'Bearer ' + t } });
    }).then(function (r) {
      if (!r.ok) throw httpError(r);
      return r.blob();
    }).then(function (blob) {
      var file = new File([blob], f.name, { type: blob.type || '' });
      return Promise.resolve(window.twOpenFile(file, null)).then(function (ok) {
        if (!ok) return;
        var d = activeDocument();
        if (d) {
          d.drive = { id: f.id, rev: f.modifiedTime, at: Date.now() };
          d.driveDirty = false;
          d.driveConflict = false;
          persistQuiet();
        }
        refresh();
        report('Opened from Google Drive · ' + f.name);
      });
    }).catch(function (e) {
      if (e.status === 401) token = null;
      report('Not opened from Google Drive: ' + e.message);
    });
  }

  /* First press only loads Google's script; the sign-in window needs a fresh click. */
  function requireGis(then) {
    if (!navigator.onLine) {
      report('Google Drive needs an internet connection. Your document is still saved on this device.');
      return;
    }
    if (!gisReady()) {
      report('Loading Google sign-in…');
      loadGis().then(
        function () { report('Google sign-in is ready. Press the Drive button again.'); },
        function (e) { report(e.message); }
      );
      return;
    }
    then();
  }

  function wireButtons() {
    var saveBtn = document.getElementById('savedrive');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        requireGis(function () {
          var d;
          try {
            syncDoc();
            d = activeDocument();
            if (!d) throw new Error('no document');
          } catch (e) {
            report('Google Drive save is not available for this document.');
            return;
          }
          var info = formatInfo(d.kind);
          report('Saving to Google Drive…');
          Promise.resolve(typeof handlesReady !== 'undefined' ? handlesReady : null)
            .then(function () { return exportCurrent(); })
            .then(function (blob) { return saveDoc(d, blob, fileNameOf(d), info.mime); })
            .then(
              function (r) {
                refresh();
                report('Saved to Google Drive · ' + r.name);
                schedule(1000); /* also brings other changed documents up to date */
              },
              function (e) { report('Not saved to Google Drive: ' + e.message); }
            );
        });
      });
    }

    var openBtn = document.getElementById('opendrive');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        requireGis(function () {
          report('Loading your Google Drive files…');
          getToken().then(listFiles).then(
            showList,
            function (e) {
              if (e.status === 401) token = null;
              report('Could not list Google Drive files: ' + e.message);
            }
          );
        });
      });
    }
  }

  window.TabbedDrive = {
    ready: gisReady,
    prepare: loadGis,
    /* call synchronously from a click: starts the sign-in window at once */
    signIn: function () { return getToken(false); },
    uploadAll: uploadAll
  };

  function start() {
    wireButtons();
    install();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
