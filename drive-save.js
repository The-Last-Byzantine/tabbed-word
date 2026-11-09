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
  var SCOPE = 'https://www.googleapis.com/auth/drive.file';
  /* Google Picker: lets the person choose a file, which is all drive.file allows us to open.
     API_KEY is a browser key (Cloud Console > Credentials > API key), restricted to the Google Picker API
     and to this app's web address. PROJECT_NUMBER is the project that holds the OAuth client. */
  var API_KEY = 'AIzaSyAv8K9QXz7WzNuZFfYLY_Hf-RyqJHy_d_I';
  var PROJECT_NUMBER = '1030444770738';
  var API_JS = 'https://apis.google.com/js/api.js';
  var GIS_URL = 'https://accounts.google.com/gsi/client';
  var FILES = 'https://www.googleapis.com/drive/v3/files';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
  var DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  /* Google Docs: opened by exporting them as .docx; saved back by uploading .docx, which Drive
     converts into the same Google Doc (same file, same link). */
  var GDOC = 'application/vnd.google-apps.document';
  var OPEN_MIMES = [GDOC, DOCX, 'application/vnd.oasis.opendocument.text', 'application/msword',
                    'text/plain', 'text/markdown', 'text/html'];
  var OPEN_EXT = /\.(docx|odt|doc|txt|md|markdown|html?)$/i;
  /* Drive files can have names without an ending; the app reads the format from the ending. */
  var EXT_OF = {};
  EXT_OF[DOCX] = '.docx'; EXT_OF['application/vnd.oasis.opendocument.text'] = '.odt';
  EXT_OF['application/msword'] = '.doc'; EXT_OF['text/plain'] = '.txt';
  EXT_OF['text/markdown'] = '.md'; EXT_OF['text/html'] = '.html';
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

  /* targetMime: the Drive type of a new file. GDOC makes Drive convert the uploaded .docx. */
  function upload(blob, fileName, mime, existingId, accessToken, targetMime) {
    var boundary = 'twdrive' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    var meta = existingId ? { name: fileName } : { name: fileName, mimeType: targetMime || mime };
    var body = new Blob([
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(meta),
      '\r\n--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n',
      blob,
      '\r\n--' + boundary + '--'
    ], { type: 'multipart/related; boundary=' + boundary });
    var url = UPLOAD + (existingId ? '/' + encodeURIComponent(existingId) : '') +
      '?uploadType=multipart&fields=id,name,modifiedTime,mimeType';
    return fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: body
    }).then(function (r) { if (r.ok) return r.json(); throw httpError(r); });
  }

  function isGdoc(d) { return !!(d && d.drive && d.drive.gdoc); }

  /* A Google Doc keeps its plain title on Drive, with no .docx ending. */
  function gdocName(d) {
    return String(d.name || d.title || 'Untitled document').replace(/\.(docx?|odt|rtf|txt|md|markdown|html?)$/i, '') || 'Untitled document';
  }

  /* What goes up to Drive for this document: its own format, or .docx for a Google Doc. */
  function payload(d) {
    if (isGdoc(d)) return { blob: exportDocx(), name: gdocName(d), mime: DOCX };
    /* keep the Drive name exactly as it was when the app only added an ending to open it */
    var name = (d.drive && d.drive.driveName) ? d.drive.driveName : fileNameOf(d);
    return { blob: exportCurrent(), name: name, mime: formatInfo(d.kind).mime };
  }

  /* After Drive converts an upload into a Google Doc, its modified time can move once more. */
  function settledRev(f, t) {
    if (f.mimeType !== GDOC) return Promise.resolve(f);
    return fetch(FILES + '/' + encodeURIComponent(f.id) + '?fields=id,name,modifiedTime,mimeType', {
      headers: { Authorization: 'Bearer ' + t }
    }).then(function (r) { return r.ok ? r.json() : f; }, function () { return f; });
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
    else txt = (d.drive.gdoc ? 'Synced to Google Docs' : 'Synced to Google Drive') + (d.drive.at ? ' · ' + timeLabel(d.drive.at) : '');
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
          return settledRev(f, t);
        }).then(function (f) {
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
        var out = payload(d);
        return out.blob.then(function (blob) {
          return pushDoc(d, blob, out.name, out.mime, t, mark);
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

  /* newGdoc: create a new Google Doc instead of a file in the document's own format. */
  function saveDoc(d, blob, fileName, mime, newGdoc) {
    var tok;
    return getToken().then(function (t) {
      tok = t;
      var existing = (d.drive && !newGdoc) ? d.drive.id : null;
      var target = (newGdoc || isGdoc(d)) ? GDOC : null;
      return upload(blob, fileName, mime, existing, t, target).catch(function (e) {
        if (e.status === 401) { token = null; throw new Error('The sign-in has expired. Press Google Drive again.'); }
        if (existing && e.status === 404) { d.drive = null; return upload(blob, fileName, mime, null, t, target); }
        throw e;
      });
    }).then(function (f) { return settledRev(f, tok); }).then(function (f) {
      var keep = (d.drive && d.drive.id === f.id) ? d.drive.driveName : null;
      d.drive = { id: f.id, rev: f.modifiedTime, at: Date.now(), gdoc: f.mimeType === GDOC };
      if (keep) d.drive.driveName = keep;
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

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src + '. Check your internet connection.')); };
      document.head.appendChild(s);
    });
  }

  var pickerLoading = null;
  function loadPicker() {
    if (window.google && google.picker) return Promise.resolve();
    if (pickerLoading) return pickerLoading;
    pickerLoading = loadScript(API_JS).then(function () {
      return new Promise(function (resolve, reject) {
        gapi.load('picker', { callback: resolve, onerror: function () { reject(new Error('Google Picker could not be loaded.')); } });
      });
    }).catch(function (e) { pickerLoading = null; throw e; });
    return pickerLoading;
  }

  /* Keeps Google's picker inside the window: fixed in the centre, never larger than the screen.
     Without this, Safari can place its top above the visible area, where it cannot be scrolled to. */
  function fitPickerStyle() {
    if (document.getElementById('picker-fit')) return;
    var st = document.createElement('style');
    st.id = 'picker-fit';
    st.textContent =
      '.picker-dialog-bg{position:fixed!important;top:0!important;left:0!important;width:100vw!important;height:100vh!important;z-index:10000!important}' +
      '.picker-dialog{position:fixed!important;top:50%!important;left:50%!important;transform:translate(-50%,-50%)!important;' +
      'max-width:calc(100vw - 16px)!important;max-height:calc(100vh - 16px)!important;z-index:10001!important}' +
      '.picker-dialog-content,.picker-dialog-content iframe{max-width:calc(100vw - 16px)!important;max-height:calc(100vh - 16px)!important}';
    document.head.appendChild(st);
  }

  /* Shows Google's own file chooser, limited to documents and Google Docs. Several files can be chosen at once.
     Resolves with the list of chosen files (empty if cancelled). */
  function openPicker(t) {
    if (!API_KEY || API_KEY.indexOf('PASTE_') === 0) {
      return Promise.reject(new Error('The Picker key is not set in this build.'));
    }
    return loadPicker().then(function () {
      return new Promise(function (resolve) {
        var view = new google.picker.DocsView(google.picker.ViewId.DOCS).setMimeTypes(OPEN_MIMES.join(','));
        fitPickerStyle();
        new google.picker.PickerBuilder()
          .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
          .addView(view)
          .setSize(Math.max(320, Math.min(1051, window.innerWidth - 32)), Math.max(320, Math.min(650, window.innerHeight - 32)))
          .setOAuthToken(t)
          .setDeveloperKey(API_KEY)
          .setAppId(PROJECT_NUMBER)
          .setTitle('Open a document or Google Doc from Google Drive')
          .setCallback(function (data) {
            if (data.action === google.picker.Action.PICKED) resolve(data.docs || []);
            else if (data.action === google.picker.Action.CANCEL) resolve([]);
          })
          .build()
          .setVisible(true);
      });
    });
  }

  function openDriveFile(f) {
    /* returns a promise, so several files can be opened one after another */
    var gdoc = f.mimeType === GDOC;
    var name = gdoc ? f.name.replace(/\.docx$/i, '') + '.docx' : f.name, driveName = null;
    if (!gdoc && !OPEN_EXT.test(name)) {
      var ext = EXT_OF[String(f.mimeType || '').split(';')[0]];
      if (ext) { driveName = f.name; name = f.name + ext; }
    }
    report('Opening ' + f.name + (gdoc ? ' from Google Docs…' : ' from Google Drive…'));
    return getToken().then(function (t) {
      var url = FILES + '/' + encodeURIComponent(f.id) +
        (gdoc ? '/export?mimeType=' + encodeURIComponent(DOCX) : '?alt=media');
      return fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    }).then(function (r) {
      if (!r.ok) throw httpError(r);
      return r.blob();
    }).then(function (blob) {
      var file = new File([blob], name, { type: gdoc ? DOCX : (blob.type || '') });
      return Promise.resolve(window.twOpenFile(file, null)).then(function (ok) {
        if (!ok) return;
        var d = activeDocument();
        if (d) {
          d.drive = { id: f.id, rev: f.modifiedTime, at: Date.now(), gdoc: gdoc };
          if (driveName) d.drive.driveName = driveName;
          d.driveDirty = false;
          d.driveConflict = false;
          persistQuiet();
        }
        refresh();
        report((gdoc ? 'Opened from Google Docs · ' : 'Opened from Google Drive · ') + f.name);
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
          var where = isGdoc(d) ? 'Google Docs' : 'Google Drive', out;
          report('Saving to ' + where + '…');
          Promise.resolve(typeof handlesReady !== 'undefined' ? handlesReady : null)
            .then(function () { out = payload(d); return out.blob; })
            .then(function (blob) { return saveDoc(d, blob, out.name, out.mime); })
            .then(
              function (r) {
                refresh();
                report('Saved to ' + where + ' · ' + r.name);
                schedule(1000); /* also brings other changed documents up to date */
              },
              function (e) { report('Not saved to Google Drive: ' + e.message); }
            );
        });
      });
    }

    /* Save as Google Doc: a new Google Doc made from this document. The tab then stays linked to it. */
    var gdocBtn = document.getElementById('savegdoc');
    if (gdocBtn) {
      gdocBtn.addEventListener('click', function () {
        requireGis(function () {
          var d;
          try {
            syncDoc();
            d = activeDocument();
            if (!d) throw new Error('no document');
          } catch (e) {
            report('Save as Google Doc is not available for this document.');
            return;
          }
          if (isGdoc(d)) { report('This tab is already a Google Doc. Use Save to Google Drive.'); return; }
          report('Saving as a Google Doc…');
          Promise.resolve(typeof handlesReady !== 'undefined' ? handlesReady : null)
            .then(function () { return exportDocx(); })
            .then(function (blob) { return saveDoc(d, blob, gdocName(d), DOCX, true); })
            .then(
              function (r) {
                refresh();
                report('Saved as a Google Doc · ' + r.name + '. Edits here now sync to it.');
                schedule(1000);
              },
              function (e) { report('Not saved as a Google Doc: ' + e.message); }
            );
        });
      });
    }

    var openBtn = document.getElementById('opendrive');
    if (openBtn) {
      openBtn.addEventListener('click', function () {
        requireGis(function () {
          var tokenP = getToken(false);           /* starts the sign-in window while this click is still active */
          tokenP.then(function (t) {
            return openPicker(t).then(function (docs) {
              if (!docs.length) return;
              /* one file after another, so each one lands in its own tab with its own Drive link */
              return docs.reduce(function (p, doc) {
                return p.then(function () {
                  report('Opening ' + doc.name + ' from Google Drive…');
                  return fetch(FILES + '/' + encodeURIComponent(doc.id) + '?fields=id,name,modifiedTime,mimeType', {
                    headers: { Authorization: 'Bearer ' + t }
                  }).then(function (r) { if (!r.ok) throw httpError(r); return r.json(); })
                    .then(function (meta) { return openDriveFile(meta); });
                });
              }, Promise.resolve());
            });
          }).catch(function (e) {
            if (e && e.status === 401) token = null;
            report('Could not open from Google Drive: ' + e.message, true);
          });
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
