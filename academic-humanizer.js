/* Review integration for AIScientists-Dev/academic-humanizer, MIT. */
(function(){
'use strict';
function init(){
 const C=window.TwAcademicCore,panel=document.querySelector('#tw-ribbon [data-panel=review]');if(!C||!panel)return;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const group=el('div','tw-group ah-ribbon');group.dataset.group='Academic writing';group.setAttribute('role','group');group.setAttribute('aria-label','Academic writing');
 const main=el('div','tw-gbody'),open=el('button','tw-big'),column=el('div','tw-col'),picker=el('select');open.type='button';open.id='academic-humanizer';open.title='Academic Humanizer';open.setAttribute('aria-label','Academic Humanizer');open.setAttribute('aria-haspopup','dialog');
 open.innerHTML='<svg class="ah-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2h10l6 6v14H4zM14 2v6h6M7 11h6m-6 4h4"/><path class="accent" d="m12 20 1-4 7-7 3 3-7 7zM19 10l3 3"/></svg><span class="tw-lbl">Academic<br>Humanizer</span>';
 picker.id='academic-mode';picker.setAttribute('aria-label','Academic document type');
 for(const [value,label]of Object.entries(C.modes)){const o=el('option',null,label);o.value=value;picker.append(o);}
 const auditButton=el('button','tw-sm','Local checks');auditButton.type='button';auditButton.title='Open local academic writing checks';column.append(picker,auditButton);main.append(open,column);group.append(main);panel.prepend(group);
 const dlg=el('dialog','ah-dialog');dlg.id='academic-dialog';dlg.setAttribute('aria-labelledby','ah-title');
 dlg.innerHTML=`<header class="ah-head"><div><span>REVIEW · ACADEMIC WRITING</span><h2 id="ah-title">Academic Humanizer</h2></div><button type="button" id="ah-close" aria-label="Close Academic Humanizer">×</button></header>
 <div class="ah-body"><p>Copy the editing request, paste it into Duck.ai, then paste only the revised text below. Local checks leave your document unchanged.</p>
 <div class="ah-grid"><label>Document type<select id="ah-mode"></select></label><label>Text to review<select id="ah-scope"><option value="selection">Selected body text</option><option value="body">Document body (title kept)</option></select></label></div>
 <label>Target journal, venue or agency (optional)<input id="ah-venue" maxlength="160" autocomplete="off"></label>
 <details><summary>Author voice sample (optional)</summary><textarea id="ah-sample" rows="4" maxlength="6000" placeholder="A sample of your own writing. Used as a style reference only."></textarea></details>
 <details><summary>Source text</summary><textarea id="ah-source" rows="5" readonly></textarea></details>
 <div class="ah-actions"><button type="button" id="ah-audit">Run local checks</button><button type="button" id="ah-copy-prompt">Copy request for Duck.ai</button></div>
 <p id="ah-status" role="status" aria-live="polite"></p><ol id="ah-findings"></ol>
 <p id="ah-error" class="ah-error" role="alert" hidden></p>
 <label>Revision preview<textarea id="ah-revision" rows="8" placeholder="Paste the clean revised text returned by Duck.ai here."></textarea></label>
 <p id="ah-integrity" class="ah-note"></p>
 <p class="ah-note">The check compares number, citation, equation and marker text and keeps paragraph structure. It does not verify factual accuracy or whether claims are supported. Local language patterns focus on English; rewriting instructions preserve your source language.</p>
 <p class="ah-credit">Adapted from <a href="https://github.com/AIScientists-Dev/academic-humanizer" target="_blank" rel="noopener noreferrer">Academic Humanizer v0.3.3</a> by AIScientists-Dev · MIT. Original rules and licence are included in Info. Follow your venue’s AI-assistance disclosure policy.</p></div>
 <footer class="ah-foot"><span>The original stays open. A revised document is a separate copy.</span><button type="button" id="ah-copy-revision">Copy revision</button><button type="button" id="ah-create" class="primary" disabled>Create revised document</button></footer>`;
 document.body.append(dlg);const q=s=>dlg.querySelector(s);
 for(const option of picker.options)q('#ah-mode').append(option.cloneNode(true));
 let snapshot=null,selection=null;
 function error(text){q('#ah-error').textContent=text;q('#ah-error').hidden=!text;}
 function capture(){
  if(typeof activeDoc!=='function'||!activeDoc())throw Error('Open a document first.');
  syncDoc();const d=activeDoc();if(d.kind==='html')throw Error('Academic review is available for text documents.');
  const caret=typeof editingCaret==='function'?editingCaret():null;
  selection=caret&&caret.field==='body'&&caret.end>caret.start?{start:caret.start,end:caret.end}:null;
  snapshot={id:d.id,body:d.body,title:d.title,start:0,end:d.body.length,text:d.body};
  q('#ah-scope').querySelector('[value=selection]').disabled=!selection;q('#ah-scope').value=selection?'selection':'body';
  refreshSource();
 }
 function refreshSource(){if(!snapshot)return;const range=q('#ah-scope').value==='selection'&&selection?selection:{start:0,end:snapshot.body.length};snapshot.start=range.start;snapshot.end=range.end;snapshot.text=snapshot.body.slice(range.start,range.end);q('#ah-source').value=snapshot.text;q('#ah-revision').value='';error('');check();localAudit();}
 function localAudit(){q('#ah-findings').replaceChildren();if(!snapshot?.text.trim()){q('#ah-status').textContent='Choose some document body text to review.';return;}
  const found=C.audit(snapshot.text,q('#ah-mode').value);q('#ah-status').textContent=found.length?`${found.length} wording checks to review. No text was changed.`:'No local wording patterns found. This is not a factual or scholarly-quality assessment.';
  for(const f of found){const item=el('li'),title=el('strong',null,f.label),location=el('small',null,' · line '+(snapshot.text.slice(0,f.start).split('\n').length)),quote=el('blockquote',null,f.quote.slice(0,260)),note=el('p',null,f.note);item.append(title,location,quote,note);q('#ah-findings').append(item);}
 }
 function check(){const revised=q('#ah-revision').value,issues=snapshot&&revised?C.integrity(snapshot.text,revised):[];q('#ah-integrity').textContent=!revised?'':issues.length?'Review required: '+issues.join('; ')+'. Correct the preview before creating a copy.':'Token and paragraph checks passed. Review the meaning before creating a copy.';q('#ah-create').disabled=!snapshot||!revised.trim()||issues.length>0;q('#ah-copy-revision').disabled=!revised.trim();}
 function options(){return {mode:q('#ah-mode').value,venue:q('#ah-venue').value.trim(),sample:q('#ah-sample').value.trim()};}
 function requestText(){if(!snapshot?.text.trim())throw Error('Choose some document text first.');return C.prompt(window.TwAcademicRules,snapshot.text,options());}
 async function copy(text){try{await navigator.clipboard.writeText(text);}catch{const box=el('textarea');box.value=text;document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();if(!ok)throw Error('Clipboard access failed. Select the preview text and copy it.');}}
 function cleanPreview(){const input=q('#ah-revision');const clean=C.normalizeRevision(input.value);if(clean!==input.value){input.value=clean;q('#ah-status').textContent='Kept the revised text only; removed the response wrapper.';}check();return input.value;}
 function createCopy(){error('');try{
  syncDoc();const d=activeDoc();if(!snapshot||!d||d.id!==snapshot.id||d.body!==snapshot.body||d.title!==snapshot.title)throw Error('The source document changed. Close this panel and capture the text again.');
  const revised=cleanPreview(),issues=C.integrity(snapshot.text,revised);if(issues.length)throw Error(issues.join('; '));
  const after=d.body.slice(0,snapshot.start)+revised+d.body.slice(snapshot.end),copy=C.rewriteCopy(d,d.body,after);
  copy.id=crypto.randomUUID();copy.name=d.name.replace(/\.[^.]+$/,'')+' - reviewed.docx';copy.kind='docx';
  copy.academicReview={project:'AIScientists-Dev/academic-humanizer',version:'0.3.3',mode:q('#ah-mode').value,at:new Date().toISOString()};
  addDoc(copy);persistDrafts();dlg.close();status('Created a revised document · original kept');
 }catch(e){error(e.message);}}
 function openDialog(){if(dlg.open)return;try{capture();q('#ah-mode').value=picker.value;localAudit();dlg.showModal();}catch(e){if(typeof status==='function')status(e.message);}}
 open.addEventListener('pointerdown',()=>{if(typeof rememberRichCaret==='function')rememberRichCaret();});
 open.addEventListener('click',openDialog);auditButton.addEventListener('pointerdown',()=>{if(typeof rememberRichCaret==='function')rememberRichCaret();});auditButton.addEventListener('click',openDialog);
 picker.addEventListener('pointerdown',()=>{if(typeof rememberRichCaret==='function')rememberRichCaret();});picker.addEventListener('change',()=>{if(dlg.open){q('#ah-mode').value=picker.value;localAudit();}});
 q('#ah-mode').addEventListener('change',()=>{picker.value=q('#ah-mode').value;q('#ah-revision').value='';check();localAudit();});q('#ah-scope').addEventListener('change',refreshSource);
 q('#ah-audit').addEventListener('click',localAudit);q('#ah-revision').addEventListener('input',check);q('#ah-revision').addEventListener('blur',cleanPreview);q('#ah-revision').addEventListener('paste',(event)=>{const text=event.clipboardData?.getData('text/plain');if(typeof text!=='string')return;const clean=C.normalizeRevision(text);if(clean!==text){event.preventDefault();const box=q('#ah-revision');box.setRangeText(clean,box.selectionStart,box.selectionEnd,'end');cleanPreview();q('#ah-status').textContent='Pasted the revised text only.';}});q('#ah-create').addEventListener('click',createCopy);
 q('#ah-copy-prompt').addEventListener('click',async()=>{try{await copy(requestText());q('#ah-status').textContent='Request copied. Paste it into Duck.ai; the reply will be requested as plain revised text only. Paste that text into the preview.';}catch(e){error(e.message);}});
 q('#ah-copy-revision').addEventListener('click',async()=>{try{await copy(cleanPreview());q('#ah-status').textContent='Revision copied.';}catch(e){error(e.message);}});
 q('#ah-close').addEventListener('click',()=>dlg.close());
 const menu=(window.twMenus||[]).find(m=>m.name==='Tools');if(menu)menu.items.push({sep:true},{label:'Academic Humanizer…',act:openDialog});
 const about=document.querySelector('.tw-about-sec[data-sec=about]');if(about){const release=el('div','ah-release');release.innerHTML='<p><strong>New in 2026.11.71</strong></p><ul><li>Copy-and-paste review with Duck.ai, requesting clean revised text only. Online rewriting controls removed.</li><li>Active document filename centered in the upper bar.</li><li>Review → Academic Humanizer, with document-type selector, offline wording checks, plain-text revision preview and a separate revised copy.</li></ul>';about.prepend(release);const credit=el('details');credit.id='academic-credit';credit.innerHTML='<summary>Academic Humanizer · credits and licence</summary><p>Adapted from <a href="https://github.com/AIScientists-Dev/academic-humanizer" target="_blank" rel="noopener noreferrer">academic-humanizer</a> v0.3.3 by AIScientists-Dev. Copyright © 2026 AIScientists-Dev. MIT licence. Source snapshot: 94b88b2.</p><p>The upstream project builds on blader/humanizer (MIT) and acknowledges koaeraser/ARMS. TabbedWord adds local checks, document-type controls, AI request/preview and revised-copy handling; the upstream project supplies the academic editing rules.</p><p><a href="academic-humanizer/LICENSE" target="_blank" rel="noopener">Full licence</a> · <a href="academic-humanizer/SKILL.md" target="_blank" rel="noopener">Original rules</a> · <a href="academic-humanizer/before-after.md" target="_blank" rel="noopener">Examples</a></p><p>Local checks and request generation work offline. For rewriting, copy the request into Duck.ai and paste the clean revised text back here. No API connection is used by this panel. Review the revision for factual correctness before using it. AI-assistance disclosure remains subject to the venue’s policy.</p>';about.append(credit);}
 const filename=document.getElementById('filename');if(filename){const sync=()=>{filename.title=filename.textContent.replace(/^●\s*/,'');};new MutationObserver(sync).observe(filename,{childList:true,characterData:true,subtree:true});sync();}
 window.twAcademic={open:openDialog,core:C};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
