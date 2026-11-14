/* Tabbed Word mobile layer. Runs only on phones and tablets (touch devices with a narrow screen).
   It detects iOS, iPadOS and Android, builds a writing bar above the on-screen keyboard and a
   formatting sheet, and keeps the existing ribbon buttons, sections, tabs and spell check working:
   every control forwards its click to the original button. Desktop is not changed. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
  var iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var narrow = Math.min(screen.width, screen.height) < 820;
  var phone = touch && (narrow || /Mobile/.test(ua));
  if (!phone && !(touch && (iOS || android))) return;

  var root = document.documentElement;
  root.classList.add('tw-m');
  root.classList.add(iOS ? 'tw-ios' : android ? 'tw-android' : 'tw-touch');
  root.classList.add(Math.max(screen.width, screen.height) >= 1000 ? 'tw-tablet' : 'tw-phone');
  root.setAttribute('data-platform', iOS ? 'ios' : android ? 'android' : 'other');

  function byId(id) { return document.getElementById(id); }
  /* Forwards a click to an original control; disabled originals stay disabled on the copy */
  function forward(id) {
    var src = byId(id);
    if (src && !src.disabled) src.click();
  }
  function make(tag, cls, text, title) {
    var b = document.createElement(tag || 'button');
    if (tag !== 'span' && tag !== 'div') b.type = 'button';
    if (cls) b.className = cls;
    if (text) b.textContent = text;
    if (title) { b.title = title; b.setAttribute('aria-label', title); }
    return b;
  }

  /* ----- writing bar, fixed above the keyboard ----- */
  var bar = make('div', 'tw-mbar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Writing tools');
  var items = [
    ['Undo', '↶', function () { document.execCommand('undo'); }],
    ['Redo', '↷', function () { document.execCommand('redo'); }],
    ['Bold', 'B', function () { forward('boldtext'); }, 'tw-b'],
    ['Italic', 'I', function () { forward('italictext'); }, 'tw-i'],
    ['Underline', 'U', function () { forward('underlinetext'); }, 'tw-u'],
    ['Bullets', '•≡', function () { forward('bulletlist'); }],
    ['Find', '⌕', function () { forward('findreplace'); }],
    ['Spell check', 'ABC', function () { forward('spellon'); }, 'tw-abc'],
    ['Formatting', 'Aa', function () { toggleSheet(); }, 'tw-aa']
  ];
  items.forEach(function (it) {
    var b = make('button', 'tw-mkey' + (it[3] ? ' ' + it[3] : ''), it[1], it[0]);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function () { it[2](); });
    bar.appendChild(b);
  });

  /* ----- formatting sheet: the Home ribbon's commands in a grid ----- */
  var sheet = make('div', 'tw-msheet');
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Formatting');
  var groups = [
    ['Paragraph', [['Align left', 'alignleft'], ['Center', 'aligncenter'], ['Align right', 'alignright'], ['Justify', 'alignjustify'], ['Numbers', 'numberlist'], ['Bullets', 'bulletlist']]],
    ['Text', [['Strike', 'strikebtn'], ['Subscript', 'subbtn'], ['Superscript', 'supbtn'], ['Case', 'casebtn'], ['Grow', 'growfont'], ['Shrink', 'shrinkfont'], ['Colour', 'colorbtn'], ['Highlight', 'hltext']]],
    ['Insert', [['Table', 'instable'], ['Image', 'insimage'], ['Header', 'inshead'], ['Footer', 'insfoot'], ['Page numbers', 'pagenumbers'], ['Footnote', 'insertnote'], ['Comment', 'newcomment']]],
    ['More', [['Format painter', 'formatpainter'], ['Clear styles', 'clearstyles']]]
  ];
  groups.forEach(function (g) {
    var h = make('h3', '', g[0]);
    sheet.appendChild(h);
    var grid = make('div', 'tw-mgrid');
    g[1].forEach(function (c) {
      var src = byId(c[1]);
      if (!src) return;
      var b = make('button', 'tw-mcell', c[0], c[0]);
      b.addEventListener('click', function () { forward(c[1]); if (c[1] !== 'colorbtn' && c[1] !== 'casebtn') hideSheet(); });
      grid.appendChild(b);
    });
    if (grid.children.length) sheet.appendChild(grid);
  });

  var fontRow=make('div','tw-mfontrow');
  [['fontpick','Font'],['sizepick','Size'],['paragraphstyle','Style']].forEach(function(pair){
    var source=byId(pair[0]);if(!source)return;var label=document.createElement('label');label.append(document.createTextNode(pair[1]));var select=source.cloneNode(true);select.id='mobile-'+pair[0];select.dataset.mobileSelect=pair[0];select.setAttribute('aria-label',pair[1]);
    select.addEventListener('pointerdown',captureMobileCaret);select.addEventListener('change',function(){restoreMobileCaret();flushMobile();source.value=select.value;source.dispatchEvent(new Event('change',{bubbles:true}));});label.append(select);fontRow.append(label);
  });
  sheet.prepend(fontRow);

  /* ----- top strip: the open document, and new, open, save ----- */
  var top = make('div', 'tw-mtop');
  var name = make('span', 'tw-mname', 'Tabbed Word');
  top.appendChild(name);
  [['New', 'new', '+'], ['Open', 'open', '⌂'], ['Save', 'save', '✓']].forEach(function (c) {
    var b = make('button', 'tw-mtopbtn', c[2], c[0]);
    b.addEventListener('click', function () { forward(c[1]); });
    top.appendChild(b);
  });

  function toggleSheet() { if (sheet.hidden) showSheet(); else hideSheet(); }
  function showSheet() { sheet.querySelectorAll('[data-mobile-select]').forEach(function(select){var source=byId(select.dataset.mobileSelect);if(source){select.value=source.value;select.disabled=source.disabled;}});sheet.hidden = false; root.classList.add('tw-sheet-open'); }
  function hideSheet() { sheet.hidden = true; root.classList.remove('tw-sheet-open'); }

  /* Show/Hide tabs and Show/Hide tools toggles belong to the desktop side panels: hidden on phones */
  function hideSidePanelToggles() {
    document.querySelectorAll('button,[role="button"]').forEach(function (b) {
      if (/^\s*[‹›]?\s*(Hide|Show)\s+(tabs|tools|panels)/i.test(b.textContent || '') || /^\s*Panels\s*[›‹]/i.test(b.textContent || '')) b.classList.add('tw-hidden');
    });
  }
  /* Some desktop rules set the three-column workspace with higher priority, so the phone layout is set inline */
  function flattenWorkspace() {
    var m = document.querySelector('main');
    if (!m) return;
    m.style.setProperty('display', 'block', 'important');
    m.style.setProperty('grid-template-columns', 'none', 'important');
    m.style.setProperty('margin', '0', 'important');
    m.style.setProperty('padding', '0', 'important');
    var rail = document.getElementById('sectionrail');
    if (rail) { rail.style.setProperty('height', 'auto', 'important'); rail.style.setProperty('min-height', '0', 'important'); rail.style.setProperty('max-height', 'none', 'important'); rail.style.setProperty('width', '100%', 'important'); }
    var t = document.getElementById('tw-titlebar');
    if (t) t.style.setProperty('display', 'none', 'important');
  }
  function mount() {
    flattenWorkspace();
    document.body.appendChild(top);
    document.body.appendChild(files);
    document.body.appendChild(sheet);
    document.body.appendChild(bar);
    refreshName();
    hideSidePanelToggles();
    if(typeof renderPages==='function'&&typeof activeDoc==='function'&&activeDoc()){pageKey='';renderPages();}
    queueLayout();
  }
  function refreshName() {
    var active = document.querySelector('#vtabs .tab-wrap.active [role="tab"]') || document.querySelector('#vtabs [aria-selected="true"]') || document.querySelector('#tabs [aria-selected="true"]');
    var t = active ? active.textContent.replace(/\s*×\s*$/, '').trim() : '';
    var next = t || 'Tabbed Word';
    if (name.textContent !== next) name.textContent = next;
  }

  /* Keep the bar above the keyboard: the visual viewport shrinks when the keyboard opens */
  function placeAboveKeyboard() {
    var vv = window.visualViewport;
    var kb = 0;
    if (vv) kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    var value = kb + 'px';
    if (root.style.getPropertyValue('--tw-kb') !== value) root.style.setProperty('--tw-kb', value);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', placeAboveKeyboard);
    window.visualViewport.addEventListener('scroll', placeAboveKeyboard);
  }
  window.addEventListener('resize', placeAboveKeyboard);

  /* Typing: the system keyboard should capitalise sentences, correct words and offer a return key.
     The app's own spell check keeps working; the system spell underline is turned off so the two
     do not mark the same word twice. */
  function tuneEditors() {
    document.querySelectorAll('[contenteditable="true"], textarea').forEach(function (el) {
      el.setAttribute('autocapitalize', 'sentences');
      el.setAttribute('autocorrect', 'on');
      el.setAttribute('enterkeyhint', 'enter');
      if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck', 'false');
    });
  }
  /* Observe editor mounts and tab changes, not each text-node mutation.
     Never rewrite layout or the mobile title in response to our own changes. */
  var tuneTimer = null, pendingEditors = new Set(), namePending = false;
  function queueMobileMaintenance(records) {
    records.forEach(function(record) {
      var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (!target || target.closest('.tw-mtop, .tw-mbar, .tw-msheet')) return;
      if (target.closest('#tabs, #vtabs')) namePending = true;
      record.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.matches('[contenteditable="true"], textarea')) pendingEditors.add(node);
        node.querySelectorAll('[contenteditable="true"], textarea').forEach(function(editor) { pendingEditors.add(editor); });
      });
    });
    if (!pendingEditors.size && !namePending) return;
    clearTimeout(tuneTimer);
    tuneTimer = setTimeout(function() {
      pendingEditors.forEach(function(el) {
        if (!el.isConnected) return;
        if (el.getAttribute('autocapitalize') !== 'sentences') el.setAttribute('autocapitalize','sentences');
        if (el.getAttribute('autocorrect') !== 'on') el.setAttribute('autocorrect','on');
        if (el.getAttribute('enterkeyhint') !== 'enter') el.setAttribute('enterkeyhint','enter');
        if (el.getAttribute('spellcheck') !== 'false') el.setAttribute('spellcheck','false');
      });
      pendingEditors.clear();
      if (namePending) refreshName();
      namePending = false;
    }, 250);
  }
  new MutationObserver(queueMobileMaintenance).observe(document.body, {childList:true,subtree:true});

  /* Spell check starts on for phones (once), and the Spell key shows whether it is on */
  var spellBox = null;
  function syncSpellKey() {
    var key = bar.querySelector('[aria-label="Spell check"]');
    if (spellBox && key) key.setAttribute('aria-pressed', String(!!spellBox.checked));
  }
  function initSpell() {
    spellBox = byId('spellon');
    if (!spellBox) return;
    try {
      if (!localStorage.getItem('tw-spell-phone-default')) {
        if (!spellBox.checked) spellBox.click();
        localStorage.setItem('tw-spell-phone-default', '1');
      }
    } catch (e) {}
    spellBox.addEventListener('change', syncSpellKey);
    syncSpellKey();
  }
  setTimeout(initSpell, 400);

  /* Save the open text when the phone hides or switches apps, as the desktop does on page hide */
  function flushText() { if (typeof window.flushSurface === 'function') { try { window.flushSurface(); } catch (e) {} } }
  window.addEventListener('pagehide', flushText);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushText(); });

  /* Tap outside the sheet closes it */
  document.addEventListener('pointerdown', function (e) {
    if (!sheet.hidden && !sheet.contains(e.target) && !e.target.closest('.tw-aa')) hideSheet();
  });

  /* Mobile file/session commands reuse the desktop engine, never duplicate its model. */
  var files = make('div','tw-mfiles');files.hidden=true;files.setAttribute('role','dialog');files.setAttribute('aria-label','Documents and sections');
  var filesHead=make('div','tw-mfiles-head'),filesTitle=make('h2','','Documents & sections'),filesClose=make('button','','×','Close documents menu');filesHead.append(filesTitle,filesClose);files.append(filesHead);
  var fileButton=make('button','tw-mtopbtn tw-mfilebtn','⋯','Documents and sections');fileButton.setAttribute('aria-haspopup','dialog');fileButton.setAttribute('aria-expanded','false');top.append(fileButton);
  var savedCaret=null,savedRange=null,savedDoc=null;
  function captureMobileCaret(){
    if(typeof rememberRichCaret==='function')rememberRichCaret();
    var selection=window.getSelection(),surface=document.querySelector('#docpages .doc-surface');
    if(selection&&selection.rangeCount&&surface&&surface.contains(selection.anchorNode)){
      savedRange=selection.getRangeAt(0).cloneRange();savedCaret=typeof pageState==='function'?pageState():null;savedDoc=typeof activeDoc==='function'&&activeDoc()?activeDoc().id:null;
    }
  }
  function restoreMobileCaret(){
    var d=typeof activeDoc==='function'?activeDoc():null;if(!d||d.id!==savedDoc)return;
    var surface=document.querySelector('#docpages .doc-surface');
    if(surface&&savedRange&&savedRange.startContainer.isConnected){surface.focus({preventScroll:true});var s=window.getSelection();s.removeAllRanges();s.addRange(savedRange);}
    else if(savedCaret&&typeof focusPageCaret==='function')focusPageCaret(savedCaret,true);
  }
  function flushMobile(){if(typeof flushSurface==='function')flushSurface();if(typeof syncDoc==='function')syncDoc();}
  function closeFiles(){files.hidden=true;fileButton.setAttribute('aria-expanded','false');}
  filesClose.addEventListener('click',closeFiles);
  var commands=[];
  function commandGroup(label,items){
    var details=make('details','tw-mfilegroup');details.open=commands.length===0;var summary=make('summary','',label);details.append(summary);var grid=make('div','tw-mfilegrid');
    items.forEach(function(c){var b=make('button','tw-mfileaction',c.label);b.dataset.mobileCommand=c.key||c.id||c.label;b.addEventListener('click',function(){
      if(b.disabled)return;closeFiles();if(c.caret)restoreMobileCaret();flushMobile();if(c.run)c.run();else forward(c.id);
    });grid.append(b);commands.push({button:b,command:c});});details.append(grid);files.append(details);
  }
  function menuAction(menu,label){var m=(window.twMenus||[]).find(function(x){return x.name===menu;}),item=m&&m.items.find(function(x){return x.label===label;});if(item){if(item.act)item.act();else if(item.id)forward(item.id);}}
  function safePart(text){return String(text||'Untitled').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').trim()||'Untitled';}
  function saveCopies(allSections){
    if(typeof guard!=='function')return;
    return guard(async function(){
      flushMobile();var original=activeDoc(),previous=original&&original.id;
      var list=(window.twSessionOrder?window.twSessionOrder():docs.slice()).filter(function(d){return allSections||!original||d.section===original.section;});
      if(!list.length)return;
      var zip=new JSZip(),used={};
      try{for(var d of list){switchDoc(d.id);var blob=await exportCurrent();var folder=allSections?safePart(window.twSectionName?window.twSectionName(d.section):'Section')+'/':'';
        var filename=safePart(d.name),path=folder+filename,number=1;while(used[path]){number++;path=folder+filename.replace(/(\.[^.]+)?$/,function(ext){return ' ('+number+')'+ext;});}used[path]=true;zip.file(path,await blob.arrayBuffer());}
        var archive=await zip.generateAsync({type:'blob',compression:'DEFLATE'});downloadLocal(archive,allSections?'TabbedWord-all-sections.zip':'TabbedWord-section-documents.zip');
        status('Saved '+list.length+' document copies in one ZIP. Tabs stay open.');
      }finally{if(previous&&docs.some(function(d){return d.id===previous;}))switchDoc(previous);}
    });
  }
  commandGroup('Document',[
    {label:'New document',id:'new'}, {label:'Open file',id:'open'}, {label:'Save',id:'save',need:true}, {label:'Save as…',id:'saveas',need:true},
    {label:'Save as PDF',id:'exportpdf',need:true}, {label:'Close document',key:'close-document',need:true,run:function(){if(window.twCloseNoSave)window.twCloseNoSave();}}
  ]);
  commandGroup('Save & upload',[
    {label:'Save all tabs in this section · ZIP',key:'save-section-zip',need:true,run:function(){return saveCopies(false);}},
    {label:'Save all sections · ZIP',key:'save-all-zip',need:true,run:function(){return saveCopies(true);}},
    {label:'Save to Google Drive',id:'savedrive',need:true},
    {label:'Save all to Drive & close saved tabs',key:'drive-all',need:true,run:function(){var b=document.querySelector('#tw-titlebar button[title="Save all to Google Drive"]');if(b)b.click();}},
    {label:'Save to Organizer',key:'organizer-save',need:true,run:function(){if(window.TabbedOrganizerActions)window.TabbedOrganizerActions.save();}},
    {label:'Open from Google Drive',id:'opendrive'}, {label:'Open from Organizer',key:'organizer-open',run:function(){if(window.TabbedOrganizerActions)window.TabbedOrganizerActions.open();}}
  ]);
  commandGroup('Tabs & sections',[
    {label:'Split at cursor',key:'split-mobile',need:true,caret:true,run:function(){window.twSplitAtPage();}},
    {label:'Combine selected tabs',key:'combine-mobile',need:true,run:function(){window.twCombineTabs();}},
    {label:'New section',key:'new-section',run:function(){window.twNewSection();}},
    {label:'Combine all sections into Word file',key:'compile-sections',need:true,run:function(){window.twCompile();}}
  ]);
  commandGroup('Sessions & drafts',[
    {label:'Save all sections as a session',id:'backupworkspace',need:true}, {label:'Restore session',id:'restoreworkspace'},
    {label:'Close session',id:'closesession',need:true}, {label:'Save all & close this section',key:'save-close-section',need:true,run:function(){window.twSaveAllClose();}},
    {label:'Discard this section’s tabs',key:'discard-section',need:true,run:function(){window.twDiscardAll();}},
    {label:'Save a version',key:'save-version',need:true,run:function(){if(window.twSaveVersion)window.twSaveVersion();}}
  ]);
  commandGroup('Help',[
    {label:'Keyboard shortcuts',id:'aboutshortcuts'}, {label:'Backups & drafts',id:'aboutbackups'}, {label:'About Tabbed Word',id:'aboutinfo'}
  ]);
  fileButton.addEventListener('pointerdown',captureMobileCaret);
  fileButton.addEventListener('click',function(){
    if(!files.hidden){closeFiles();return;}captureMobileCaret();flushMobile();hideSheet();
    var has=typeof activeDoc==='function'&&!!activeDoc(),working=typeof busy!=='undefined'&&busy;
    commands.forEach(function(pair){var c=pair.command,source=c.id&&byId(c.id);pair.button.disabled=!!working||!!(c.need&&!has)||!!(source&&source.disabled);});
    var active=document.activeElement;if(active&&active.closest&&active.closest('#docpages'))active.blur();files.hidden=false;fileButton.setAttribute('aria-expanded','true');
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeFiles();hideSheet();}});
  document.addEventListener('pointerdown',function(e){if(!files.hidden&&!files.contains(e.target)&&!fileButton.contains(e.target))closeFiles();});

  /* Full-height growing paper and keyboard-aware caret following. No nested text scroller. */
  var layoutFrame=0,followFrame=0,lastInput=0,composingMobile=false,panningUntil=0;
  function mobileLayout(){
    layoutFrame=0;var viewport=window.visualViewport,height=viewport?viewport.height:window.innerHeight;
    var chrome=byId('tw-chrome'),rail=byId('sectionrail'),chromeHeight=chrome?chrome.offsetHeight:50;
    root.style.setProperty('--tw-mobile-chrome-height',chromeHeight+'px');
    root.style.setProperty('--tw-mobile-viewport-height',height+'px');
    var free=Math.max(240,height-top.offsetHeight-chromeHeight-(rail?rail.offsetHeight:48)-bar.offsetHeight-48);
    root.style.setProperty('--tw-mobile-page-min',Math.round(free)+'px');
  }
  function queueLayout(){if(!layoutFrame)layoutFrame=requestAnimationFrame(mobileLayout);}
  function followCaret(){
    followFrame=0;if(composingMobile||Date.now()<panningUntil||!sheet.hidden||!files.hidden)return;
    var surface=document.querySelector('#docpages .doc-surface'),selection=window.getSelection();
    if(!surface||document.activeElement!==surface||!selection||!selection.rangeCount||!selection.isCollapsed||!surface.contains(selection.anchorNode))return;
    var range=selection.getRangeAt(0),rect=range.getBoundingClientRect();
    // WebKit can report a zero-sized collapsed range just after Enter.
    if(!rect||rect.height===0){
      var node=range.startContainer,offset=range.startOffset;
      if(node.nodeType===3&&node.length){var probe=range.cloneRange();if(offset>0)probe.setStart(node,offset-1);else probe.setEnd(node,1);var rects=probe.getClientRects();if(rects.length)rect=rects[rects.length-1];}
      if(!rect||rect.height===0){var parent=node.nodeType===1?node:node.parentElement,block=parent&&parent.closest('.dp');if(block&&!block.textContent.trim())rect=block.getBoundingClientRect();}
    }
    if(!rect||rect.height===0)return;
    var vv=window.visualViewport,vtop=vv?vv.offsetTop:0,vheight=vv?vv.height:innerHeight;
    var chrome=byId('tw-chrome'),topEdge=vtop+top.offsetHeight+(chrome?chrome.offsetHeight:50)+10;
    var bottomEdge=vtop+vheight-bar.offsetHeight-18,barTop=bar.getBoundingClientRect().top;if(barTop>topEdge)bottomEdge=Math.min(bottomEdge,barTop-16);
    if(rect.bottom>bottomEdge)window.scrollBy(0,Math.ceil(rect.bottom-bottomEdge));
    else if(rect.top<topEdge)window.scrollBy(0,Math.floor(rect.top-topEdge));
  }
  function queueFollow(){if(!followFrame)followFrame=requestAnimationFrame(function(){followFrame=requestAnimationFrame(followCaret);});}
  document.addEventListener('input',function(e){if(e.target.closest&&e.target.closest('#docpages .doc-surface')){lastInput=Date.now();queueFollow();}},true);
  document.addEventListener('compositionstart',function(e){if(e.target.closest&&e.target.closest('#docpages'))composingMobile=true;},true);
  document.addEventListener('compositionend',function(e){if(e.target.closest&&e.target.closest('#docpages')){composingMobile=false;lastInput=Date.now();queueFollow();}},true);
  document.addEventListener('selectionchange',function(){if(Date.now()-lastInput<700)queueFollow();});
  document.addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('#docpages')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','End','Home','Enter','Backspace','Delete'].includes(e.key))queueFollow();},true);
  document.addEventListener('touchmove',function(){panningUntil=Date.now()+400;},{passive:true});
  window.addEventListener('resize',function(){queueLayout();queueFollow();});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',function(){queueLayout();queueFollow();});
  if(window.ResizeObserver){var mobileMetrics=new ResizeObserver(queueLayout);[top,bar,byId('tw-chrome'),byId('sectionrail')].forEach(function(n){if(n)mobileMetrics.observe(n);});}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); tuneEditors(); placeAboveKeyboard(); });
  else { mount(); tuneEditors(); placeAboveKeyboard(); }
})();
