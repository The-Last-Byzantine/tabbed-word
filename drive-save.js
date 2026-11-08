/* Google Drive: optional save and open (no sharing, no sync).
   Google's sign-in script is loaded only when the person presses a Drive button,
   so offline use never contacts Google. The browser talks to Google directly;
   nothing passes through a Tabbed Word server. Tokens are kept in memory only. */
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

  var token = null, tokenExpires = 0, tokenClient = null, pending = null, loading = null;
  var fileIds = {}; /* document id -> Drive file id, for this page session only */

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
        p.resolve(token);
      },
      error_callback: function (err) {
        var p = pending;
        pending = null;
        if (p) p.reject(new Error('The Google sign-in window was closed.' + (err && err.type ? ' (' + err.type + ')' : '')));
      }
    });
  }

  /* Must run synchronously inside the click that starts it, or browsers block the sign-in window. */
  function getToken() {
    if (token && Date.now() < tokenExpires - 60000) return Promise.resolve(token);
    ensureTokenClient();
    return new Promise(function (resolve, reject) {
      pending = { resolve: resolve, reject: reject };
      tokenClient.requestAccessToken({ prompt: '' });
    });
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
      '?uploadType=multipart&fields=id,name';
    return fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: body
    }).then(function (r) { if (r.ok) return r.json(); throw httpError(r); });
  }

  /* Save the document under one name; later saves in this session update the same Drive file. */
  function save(key, blob, fileName, mime) {
    return getToken().then(function (t) {
      var existing = fileIds[key] || null;
      return upload(blob, fileName, mime, existing, t).catch(function (e) {
        if (e.status === 401) { token = null; throw new Error('The sign-in has expired. Press Google Drive again.'); }
        if (existing && e.status === 404) { delete fileIds[key]; return upload(blob, fileName, mime, null, t); }
        throw e;
      });
    }).then(function (f) {
      fileIds[key] = f.id;
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
      var cancel = dlg.querySelector('#drive-open-cancel');
      cancel.addEventListener('click', function () { dlg.close(); });
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
        var d = activeDoc();
        if (d) fileIds[d.id] = f.id; /* Drive button now saves back to this file */
        report('Opened from Google Drive · ' + f.name + ' · the Drive button saves back to it');
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

  var saveBtn = document.getElementById('savedrive');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      requireGis(function () {
        var d, info, fileName;
        try {
          syncDoc();
          d = activeDoc();
          info = formatInfo(d.kind);
          fileName = (typeof name === 'string' && name) ? name : info.defaultName;
          if (!/\.[a-z0-9]{2,5}$/i.test(fileName)) fileName += info.extensions[0];
        } catch (e) {
          report('Google Drive save is not available for this document.');
          return;
        }
        report('Saving to Google Drive…');
        Promise.resolve(typeof handlesReady !== 'undefined' ? handlesReady : null)
          .then(function () { return exportCurrent(); })
          .then(function (blob) { return save(d.id, blob, fileName, info.mime); })
          .then(
            function (r) { report('Saved to Google Drive · ' + r.name); },
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

  window.TabbedDrive = {
    ready: gisReady,
    prepare: loadGis,
    /* call synchronously from a click: starts the sign-in window at once */
    signIn: getToken,
    uploadAll: uploadAll
  };
})();
