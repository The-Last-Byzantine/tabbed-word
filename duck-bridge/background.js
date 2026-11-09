// Asks duck.ai one question at a time, in a single background tab, and relays the answer back to Tabbed Word.
// The tab is reused: a new question loads into it, so no new tab opens for each question.
var DUCK_TAB = 'duckTabId';

function currentDuckTab(callback) {
  chrome.storage.session.get(DUCK_TAB, function (r) {
    var id = r[DUCK_TAB];
    if (!id) { callback(null); return; }
    chrome.tabs.get(id, function (tab) {
      if (chrome.runtime.lastError || !tab) { chrome.storage.session.remove(DUCK_TAB); callback(null); return; }
      callback(tab);
    });
  });
}

function askDuck(question) {
  var q = String(question || '').trim();
  if (!q) return;
  var url = 'https://duck.ai/?q=' + encodeURIComponent(q);
  currentDuckTab(function (tab) {
    if (tab) {
      chrome.tabs.update(tab.id, { url: url, active: false }, function () { void chrome.runtime.lastError; });
    } else {
      chrome.tabs.create({ url: url, active: false }, function (created) {
        if (created) chrome.storage.session.set({ [DUCK_TAB]: created.id });
      });
    }
  });
}

chrome.tabs.onRemoved.addListener(function (id) {
  chrome.storage.session.get(DUCK_TAB, function (r) {
    if (r[DUCK_TAB] === id) chrome.storage.session.remove(DUCK_TAB);
  });
});

chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg) return;
  if (msg.type === 'askDuck') { askDuck(msg.question); return; }
  if (msg.type === 'duckAnswer') {
    chrome.tabs.query({ url: ['https://tabbedword.pages.dev/*', 'http://localhost/*'] }, function (tabs) {
      tabs.forEach(function (t) {
        chrome.tabs.sendMessage(t.id, msg, function () { void chrome.runtime.lastError; });
      });
    });
  }
});
