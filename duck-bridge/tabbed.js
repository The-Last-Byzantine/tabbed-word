// Runs on Tabbed Word. Passes questions from the page to the background script, and answers back to the page.
window.addEventListener('message', function (e) {
  if (e.source !== window || !e.data) return;
  if (e.data.twDuckAsk === true) {
    chrome.runtime.sendMessage({ type: 'askDuck', question: String(e.data.question || '') }, function () { void chrome.runtime.lastError; });
    window.postMessage({ twDuckAck: true }, '*');
  }
});
chrome.runtime.onMessage.addListener(function (msg) {
  if (!msg || msg.type !== 'duckAnswer') return;
  window.postMessage({ twDuckAnswer: true, question: msg.question, answer: msg.answer }, '*');
});
