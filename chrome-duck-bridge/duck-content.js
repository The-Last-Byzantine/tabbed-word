/* DuckBridge 1.5.0 Duck.ai runner. Pulls its job from the worker and polls the page, so it works while the tab stays in the background. */
'use strict';
(async()=>{
 if(globalThis.__twDuck150)return;globalThis.__twDuck150=true;
 const A={composer:'textarea, [contenteditable="true"][role="textbox"]',
  send:'button[type="submit"], button[aria-label*="Send" i], button[aria-label*="Submit" i]',
  answers:'[id*="-assistant-message-"] .space-y-4.whitespace-normal, [data-message-role="assistant"], [data-role="assistant"], [data-testid="assistant-message"], [data-testid="assistant-response"], [data-role="assistant-message"], .assistant-message, [class*="markdown"], [class*="Markdown"]',
  responseRoot:'[id*="-assistant-message-"]',complete:'button[aria-label="Copy to clipboard"], button[aria-label*="Copy" i]',
  excluded:'nav, aside, header, footer, textarea, [contenteditable], [class*="reasoning"], [data-testid*="thinking"]'};
 const rpc=m=>chrome.runtime.sendMessage(m),wait=ms=>new Promise(r=>setTimeout(r,ms));
 let job,stopped=false;chrome.runtime.onMessage.addListener(m=>{if(m?.type==='DUCK_CANCEL')stopped=true;});
 for(let n=0;n<15&&!job;n++){try{job=(await rpc({type:'DUCK_GET_JOB'}))?.job;}catch{}if(!job)await wait(400);}
 if(!job)return;
 const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
 const norm=t=>String(t||'').replace(/\s+/g,' ').trim();
 const text=e=>e?.innerText?.trim()||'';
 const buttons=()=>[...document.querySelectorAll('button,[role="button"]')].filter(visible);
 const label=e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.textContent].filter(Boolean).join(' ').trim();
 const enabled=b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true';
 const busy=()=>buttons().some(b=>enabled(b)&&/\b(stop|cancel generation)\b/i.test(label(b))&&label(b).length<100);
 const candidates=()=>[...document.querySelectorAll(A.answers)].filter(e=>visible(e)&&!e.closest(A.excluded));
 const baseline=new Set(candidates().map(text));
 const LABEL=/^(duck\.?ai said|you said|assistant|copy|copied|regenerate|retry|edit|share)$/i,MODEL=/^(gpt|o\d|claude|llama|mistral|mixtral|gemini|luna|pixtral|qwen|deepseek)[\w .:-]{0,30}$/i;
 const strip=t=>{const l=t.split('\n');while(l.length>1){const f=l[0].trim();if(!f||LABEL.test(f)||MODEL.test(f)&&!/[.!?…:]$/.test(f))l.shift();else break;}while(l.length>1&&LABEL.test(l.at(-1).trim()))l.pop();return l.join('\n').trim();};
 let submitted=!!job.submitted,sawBusy=false,last='',changed=Date.now(),lastStatus='',lastPreview=0;
 async function status(phase,message){if(message===lastStatus)return;lastStatus=message;try{await rpc({type:'DUCK_STATUS',id:job.id,phase,message});}catch{}}
 function blocker(){if(document.querySelector('#challenge-running,iframe[src*="challenges.cloudflare.com"]'))return 'Duck.ai is showing verification. Open the Duck.ai tab and complete it; the bridge waits.';for(const d of document.querySelectorAll('[role="dialog"],dialog[open]')){if(/terms|privacy policy|agree.*continue/i.test(norm(d.textContent)))return 'Duck.ai needs its terms acknowledged once. Open the Duck.ai tab, accept, and the bridge continues.';}return null;}
 function answer(){
  const list=candidates().filter(e=>text(e)&&norm(text(e))!==norm(job.prompt)&&!baseline.has(text(e)));
  const el=list.filter(e=>!list.some(p=>p!==e&&p.contains(e))).at(-1);if(!el)return null;
  const copy=el.cloneNode(true);
  copy.querySelectorAll('button,[role="button"],script,style,svg,textarea,[class*="reasoning"],[class*="thinking"],[aria-hidden="true"]').forEach(e=>e.remove());
  copy.querySelectorAll('p,li,pre,blockquote,h1,h2,h3,h4,h5,h6,tr,div').forEach(e=>{e.before(document.createTextNode('\n'));e.after(document.createTextNode('\n'));});
  copy.querySelectorAll('br').forEach(e=>e.replaceWith(document.createTextNode('\n')));
  copy.querySelectorAll('ol>li').forEach((e,i)=>e.prepend(document.createTextNode([...e.parentElement.children].indexOf(e)+1+'. ')));copy.querySelectorAll('ul>li').forEach(e=>e.prepend(document.createTextNode('• ')));
  const lines=copy.textContent.split('\n').map(l=>l.replace(/[ \t ]+/g,' ').trim()),item=l=>/^(•|\d+\.) /.test(l||'');
  const value=strip(lines.filter((l,i)=>l||!(item(lines[i-1])&&item(lines.slice(i+1).find(x=>x)))).join('\n').replace(/\n{3,}/g,'\n\n').trim());
  let controls=el.closest(A.responseRoot)||el.closest('[data-message-role],[data-role],article')||el.parentElement;
  if(controls===el.parentElement&&controls?.parentElement)controls=controls.parentElement;
  const complete=!!controls&&([...controls.querySelectorAll(A.complete)].some(b=>visible(b)&&enabled(b))||[...controls.querySelectorAll('button,[role="button"]')].some(b=>visible(b)&&/copy/i.test(label(b)+' '+b.getAttribute('data-testid')+' '+b.className)));
  return{value,complete};
 }
 async function deliver(value){if(stopped||!value.trim())return;try{const r=await rpc({type:'DUCK_RESULT',id:job.id,text:value});if(r?.ok)stopped=true;}catch{await status('working','Connection interrupted; retrying the transfer…');}}
 if(submitted)baseline.clear();
 while(!stopped&&Date.now()<job.deadline){
  try{
   const state=await rpc({type:'DUCK_GET_JOB',id:job.id});if(!state?.job)break;
   const block=blocker();if(block){await status('attention',block);await wait(800);continue;}
   const box=[...document.querySelectorAll(A.composer)].find(visible);
   if(!submitted){
    if(!box){await status('working','Waiting for Duck.ai’s editor…');await wait(500);continue;}
    const value=box.matches('textarea,input')?box.value:box.textContent;
    if(value&&norm(value)!==norm(job.prompt)){await status('attention','Duck.ai’s editor already contains text. Open the Duck.ai tab and clear it to continue.');await wait(1000);continue;}
    if(!value){
     if(box.matches('textarea,input'))Object.getOwnPropertyDescriptor(box.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(box,job.prompt);
     else box.textContent=job.prompt;
     box.dispatchEvent(new Event('input',{bubbles:true}));box.dispatchEvent(new Event('change',{bubbles:true}));
     await wait(250);
    }
    const send=[...document.querySelectorAll(A.send)].find(e=>visible(e)&&enabled(e));
    /* Claim once: a reinjected runner after navigation must never submit twice. */
    if(!(await rpc({type:'DUCK_CLAIM',id:job.id}))?.ok){submitted=true;continue;}
    submitted=true;
    if(send)send.click();else{box.focus();box.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true}));}
    await status('working','Sent · waiting for Duck.ai…');
   }
   const root=document.querySelector('main')||document.body,clone=root.cloneNode(true);clone.querySelectorAll('textarea,input,[contenteditable],nav,aside').forEach(e=>e.remove());
   if(!norm(clone.textContent).includes(norm(job.prompt).slice(0,100))){await status('working','Waiting for Duck.ai to confirm the question…');await wait(600);continue;}
   const isBusy=busy();if(isBusy)sawBusy=true;
   const reply=answer();
   if(reply?.value!==last){last=reply?.value||'';changed=Date.now();if(last&&Date.now()-lastPreview>300){lastPreview=Date.now();rpc({type:'DUCK_PREVIEW',id:job.id,text:last}).catch(()=>{});}}
   await status('working',isBusy?'Duck.ai is writing…':last?'Reading the reply…':'Waiting for Duck.ai’s reply…');
   const readyBox=[...document.querySelectorAll(A.composer)].find(visible);
   const emptyBox=readyBox&&!norm(readyBox.matches('textarea,input')?readyBox.value:readyBox.textContent);
   const readySend=[...document.querySelectorAll(A.send)].some(visible);
   const quiet=Date.now()-changed;
   /* Fast path: Duck.ai's Copy control on the reply means it is complete. Otherwise: Stop gone and 1.5 s still, or a ready composer and 6 s still. */
   if(last&&!isBusy&&(reply?.complete||(sawBusy&&quiet>1500)||(emptyBox&&readySend&&quiet>6000)))await deliver(last);
   await wait(400);
  }catch{await status('working','Connection interrupted. Open the Duck.ai tab to inspect the reply.');await wait(1000);}
 }
})();
