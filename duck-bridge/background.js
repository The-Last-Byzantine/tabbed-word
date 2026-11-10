// Tabbed Word: Duck.ai bridge, background.
// Each question opens duck.ai in a background tab (never focused, no window). The tab sends back the answer
// as soon as it is ready; Tabbed Word shows it at once and the tab is closed. If nothing comes back in time,
// Tabbed Word is told and the tab is closed.
var WORD_MATCH = ['https://tabbedword.pages.dev/*', 'http://localhost/*'];
var JOB_TIMEOUT_MS = 175000;
var jobs = {};   // tab id -> { question, timer }

function relay(msg) {
  chrome.tabs.query({ url: WORD_MATCH }, function (tabs) {
    tabs.forEach(function (t) {
      chrome.tabs.sendMessage(t.id, msg, function () { void chrome.runtime.lastError; });
    });
  });
}

function closeTab(tabId) {
  var job = jobs[tabId];
  if (job) { clearTimeout(job.timer); delete jobs[tabId]; }
  chrome.tabs.remove(tabId, function () { void chrome.runtime.lastError; });
}

function askDuck(question) {
  var q = String(question || '').trim();
  if (!q) return;
  chrome.tabs.create({ url: 'https://duck.ai/?q=' + encodeURIComponent(q), active: false }, function (tab) {
    if (chrome.runtime.lastError || !tab) {
      relay({ type: 'duckAnswer', question: q, answer: 'duck.ai could not be opened. Check the extension, then ask again.' });
      return;
    }
    jobs[tab.id] = {
      question: q,
      timer: setTimeout(function () {
        if (!jobs[tab.id]) return;
        relay({ type: 'duckAnswer', question: q, answer: 'duck.ai did not answer in time. Open duck.ai, sign in if asked, then ask again.' });
        closeTab(tab.id);
      }, JOB_TIMEOUT_MS)
    };
  });
}

chrome.tabs.onRemoved.addListener(function (id) {
  if (jobs[id]) { clearTimeout(jobs[id].timer); delete jobs[id]; }
});

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg) return;
  if (msg.type === 'askDuck') { askDuck(msg.question); return; }
  if (msg.type === 'duckAnswer') {
    var tabId = sender && sender.tab ? sender.tab.id : null;
    var job = tabId != null ? jobs[tabId] : null;
    if (tabId != null && !job) return;   // a late answer for a tab already handled
    relay({ type: 'duckAnswer', question: msg.question, answer: msg.answer || '' });
    if (tabId != null) closeTab(tabId);
  }
});
