// Runs on duck.ai. Only acts on a page opened by Tabbed Word (the address carries ?q=...).
// 1. Puts the question into the chat box and sends it.
// 2. Finds the question in the conversation and passes on the text after it, once the answer has stopped changing.
(function () {
  var question = (new URLSearchParams(location.search).get('q') || '').trim();
  if (!question) return;
  try { chrome.runtime.sendMessage({ type: 'duckHello' }); } catch (e) {}
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
    if (tries < 40) setTimeout(trySend, 300);
  }
  setTimeout(trySend, 300);

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

  // Page text that is never part of the answer: labels, notices, status lines.
  var LABEL = /^(you said|you:|duck\.ai said|duck\.ai|answer|copy|copy answer|copy code|send|stop|retry|regenerate|response complete|generating( response)?[.\u2026]*|thinking[.\u2026]*|searching[.\u2026]*|new chat)$/i;
  var NOTICE = /ai can make mistakes|all chats are|chats are (saved|stored)|privacy protected|anonymized by duckduckgo|no ai training|regenerate|copy answer/i;
  var MODEL = /^(gpt|o[0-9]|claude|llama|mistral|mixtral|gemini|grok)[\w .\-]{0,30}$/i;
  function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function isNoise(l) {
    if (!l) return true;
    if (LABEL.test(l) || NOTICE.test(l)) return true;
    if (l.length <= 34 && !/[.!?:]$/.test(l) && MODEL.test(l)) return true;
    return false;
  }

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
    // Stop at the footer: everything from there on is page chrome, not answer.
    var end = lines.length;
    for (var i = 0; i < lines.length; i++) {
      if (/AI can make mistakes|All chats are|Regenerate|Copy answer/i.test(lines[i])) { end = i; break; }
    }
    lines = lines.slice(0, end);
    // Keep only answer lines: no question echo, no labels, notices or status lines.
    var out = [];
    // Normalised question text: any line that is part of it (the echo, which may span several lines) is dropped.
    var qnorm = norm(question);
    lines.forEach(function (l) {
      var ln = norm(l);
      if (l.indexOf(probe) >= 0) return;
      if (ln.length >= 6 && qnorm.indexOf(ln) >= 0) return;
      if (isNoise(l)) return;
      var c = l.replace(/Privacy protected[^.]*\.?/gi, '').replace(/No AI training\.?/gi, '').trim();
      if (c && !isNoise(c)) out.push(c);
    });
    return out.join('\n').replace(/[ \t]+/g, ' ').slice(0, 20000).trim();
  }

  var lastText = '', lastChange = Date.now();
  function tick() {
    if (sentAnswer) return;
    var q = questionNode();
    if (q) {
      var text = answerText(q);
      if (text !== lastText) { lastText = text; lastChange = Date.now(); }
      // Sent once the text has stopped changing for about a second and a half.
      if (text && Date.now() - lastChange > 900) {
        sentAnswer = true;
        chrome.runtime.sendMessage({ type: 'duckAnswer', question: question, answer: text });
        return;
      }
    }
    if (Date.now() - started > 150000) {
      sentAnswer = true;
      chrome.runtime.sendMessage({ type: 'duckAnswer', question: question, answer: 'duck.ai did not answer in time. Open duck.ai, sign in if asked, then ask again.' });
      return;
    }
    setTimeout(tick, 250);
  }
  setTimeout(tick, 300);
})();
