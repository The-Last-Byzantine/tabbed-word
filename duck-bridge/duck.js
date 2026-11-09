// Runs on duck.ai. Only acts on a page opened by Tabbed Word (the address carries ?q=...).
// 1. Puts the question into the chat box and sends it.
// 2. Finds the question in the conversation and passes on the text after it, once the answer has stopped changing.
(function () {
  var question = (new URLSearchParams(location.search).get('q') || '').trim();
  if (!question) return;
  var probe = question.slice(0, 40);
  var started = Date.now();
  var sentAnswer = false;

  function isComposer(el) {
    return !!(el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable));
  }
  function composer() {
    var list = document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]');
    for (var i = list.length - 1; i >= 0; i--) if (list[i].offsetParent !== null) return list[i];
    return null;
  }
  function composerText(box) {
    return box.tagName === 'TEXTAREA' || box.tagName === 'INPUT' ? box.value : box.textContent;
  }
  function setComposer(box, text) {
    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      var proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(box, text);
    } else {
      box.textContent = text;
    }
    box.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function send(box) {
    var btn = document.querySelector('button[type="submit"], button[aria-label*="Send" i], button[aria-label*="Submit" i]');
    if (btn && !btn.disabled) { btn.click(); return; }
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  }

  // Step 1: fill the chat box and send. Retry a few times if the page is slow to show it.
  var tries = 0;
  function trySend() {
    tries++;
    var box = composer();
    if (box && composerText(box).indexOf(probe) < 0) setComposer(box, question);
    if (box && composerText(box).indexOf(probe) >= 0) {
      box.focus();
      send(box);
      setTimeout(function () { var b = composer(); if (b && composerText(b).indexOf(probe) >= 0 && tries < 6) trySend(); }, 2000);
      return;
    }
    if (tries < 20) setTimeout(trySend, 700);
  }
  setTimeout(trySend, 1200);

  // Step 2: the question in the conversation (not in the chat box).
  function questionNode() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var found = null, n;
    while ((n = walker.nextNode())) {
      if (n.data.indexOf(probe) >= 0 && !(n.parentElement && n.parentElement.closest('textarea, input, [contenteditable="true"]'))) found = n;
    }
    return found;
  }
  var skip = 'button, textarea, input, nav, header, footer, aside, script, style, [role="navigation"], [contenteditable], [aria-hidden="true"], [role="button"]';
  var BLOCK = 'p,li,div,h1,h2,h3,h4,h5,h6,pre,blockquote,td,th,section,article,tr';
  function blockOf(el) { return (el && el.closest(BLOCK)) || el; }
  function answerText(from) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    walker.currentNode = from;
    var lines = [], cur = '', curBlock = null, n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.closest(skip)) continue;
      var t = n.data.replace(/\s+/g, ' ');
      if (!t.trim()) { if (cur && !/ $/.test(cur)) cur += ' '; continue; }
      var b = blockOf(n.parentElement);
      if (b !== curBlock) { if (cur.trim()) lines.push(cur.trim()); cur = ''; curBlock = b; }
      cur += t;
    }
    if (cur.trim()) lines.push(cur.trim());
    // Drop the footer ("AI can make mistakes" and similar) and anything after it.
    var end = lines.length;
    for (var i = 0; i < lines.length; i++) {
      if (/AI can make mistakes|All chats are|Regenerate|Copy answer/i.test(lines[i])) { end = i; break; }
    }
    lines = lines.slice(0, end);
    // Drop the header labels (model name, "said") before the answer: short lines without a sentence.
    var first = 0;
    while (first < lines.length - 1 && lines[first].split(' ').length <= 3 && !/[.!?:]$/.test(lines[first])) first++;
    return lines.slice(first).join('\n').replace(/[ \t]+/g, ' ').slice(0, 20000).trim();
  }

  var lastText = '', lastChange = Date.now();
  function tick() {
    if (sentAnswer) return;
    var q = questionNode();
    if (q) {
      var text = answerText(q);
      if (text.indexOf(probe) === 0 || text === '') { /* question only so far */ }
      if (text !== lastText) { lastText = text; lastChange = Date.now(); }
      if (text.length > 30 && Date.now() - lastChange > 2500) {
        sentAnswer = true;
        chrome.runtime.sendMessage({ type: 'duckAnswer', question: question, answer: text });
        return;
      }
    }
    if (Date.now() - started > 180000) { sentAnswer = true; return; }
    setTimeout(tick, 800);
  }
  setTimeout(tick, 2000);
})();
