/* DuckBridge 1.5.0. Session-backed jobs, page-pulled delivery (works in background tabs), owned task tab closed on delivery or cancel. */
'use strict';
const VERSION='1.5.0',key=id=>'duck:'+id,valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id),TIMEOUT=6*60*1000;
const origin=u=>{try{return new URL(u).origin;}catch{return '';}};
const word=s=>s.frameId===0&&origin(s.url)==='https://tabbedword.pages.dev';
const duckTab=(s,j)=>s.frameId===0&&s.tab?.id===j.tab&&['https://duck.ai','https://duckduckgo.com'].includes(origin(s.url));
const jobs=async()=>Object.values(await chrome.storage.session.get(null)).filter(j=>j&&j.duck===true);
const get=async id=>(await chrome.storage.session.get(key(id)))[key(id)];
const put=j=>chrome.storage.session.set({[key(j.id)]:j});
async function notify(j,e){try{await chrome.tabs.sendMessage(j.owner,{type:'DUCK_EVENT',event:{id:j.id,...e}},{frameId:0});return true;}catch{return false;}}
async function closeTab(j){if(j.tab==null)return;try{await chrome.tabs.remove(j.tab);}catch{}j.tab=null;}
async function drop(j){await chrome.storage.session.remove(key(j.id));await chrome.alarms.clear(key(j.id));}
/* Terminal states. A delivered or cancelled job closes its own tab; a failed one keeps it for inspection unless the Word tab is gone. */
async function finish(j,state,e){j.state=state;delete j.prompt;j.finished=Date.now();await put(j);const delivered=await notify(j,e);
 if(state==='done'||state==='cancelled'||!delivered)await closeTab(j);
 if(state!=='done'||!delivered)await drop(j);else{j.tab=null;await put(j);await chrome.alarms.create(key(j.id),{when:Date.now()+60000});}}
async function handle(m,s){
 if(!m||typeof m.type!=='string')return;
 if(word(s)){
  if(m.type==='DUCK_CONNECTION')return{ok:true,version:VERSION};
  if(m.type==='DUCK_START'){
   if(!valid(m.id)||typeof m.prompt!=='string'||!m.prompt.trim()||m.prompt.length>50000)throw Error('Invalid request or text too long (50,000 characters maximum).');
   for(const j of await jobs()){if(j.owner!==s.tab.id)continue;if(j.finished)await drop(j);else throw Error('This TabbedWord tab already has a Duck.ai request. Cancel it first.');}
   const j={duck:true,id:m.id,owner:s.tab.id,tab:null,state:'opening',prompt:m.prompt,submitted:false,created:Date.now(),deadline:Date.now()+TIMEOUT};
   await put(j);await chrome.alarms.create(key(j.id),{when:j.deadline});
   try{const t=await chrome.tabs.create({url:'https://duck.ai/',active:false});j.tab=t.id;await put(j);await notify(j,{type:'status',phase:'opening',message:'Opening Duck.ai in the background…'});}
   catch(e){await finish(j,'error',{type:'error',message:'Could not open Duck.ai: '+e.message});}
   return{ok:true};
  }
  if(m.type==='DUCK_RECEIVED'||m.type==='DUCK_CANCEL'){
   if(!valid(m.id))return{ok:false};const j=await get(m.id);if(!j||j.owner!==s.tab.id)return{ok:false};
   if(m.type==='DUCK_RECEIVED'){await closeTab(j);await drop(j);return{ok:true};}
   if(!j.finished){try{await chrome.tabs.sendMessage(j.tab,{type:'DUCK_CANCEL'});}catch{}await finish(j,'cancelled',{type:'cancelled',message:'Cancelled.'});}
   return{ok:true};
  }
  return;
 }
 /* Messages from the Duck.ai task tab. */
 const j=(await jobs()).find(j=>duckTab(s,j)&&(!m.id||m.id===j.id));if(!j||j.finished)return;
 if(m.type==='DUCK_GET_JOB')return{ok:true,job:{id:j.id,prompt:j.prompt,submitted:j.submitted,deadline:j.deadline}};
 if(m.type==='DUCK_CLAIM'){if(j.submitted)return{ok:false};j.submitted=true;j.state='working';await put(j);return{ok:true};}
 if(m.type==='DUCK_STATUS'){await notify(j,{type:'status',phase:String(m.phase||'working'),message:String(m.message||'Working…').slice(0,500)});return{ok:true};}
 if(m.type==='DUCK_PREVIEW'){if(typeof m.text==='string'&&m.text.length<=200000)await notify(j,{type:'preview',text:m.text});return{ok:true};}
 if(m.type==='DUCK_RESULT'){const text=String(m.text||'').trim();if(!text)return{ok:false};await finish(j,'done',{type:'done',text:text.slice(0,200000)});return{ok:true};}
 if(m.type==='DUCK_ERROR'){await finish(j,'error',{type:'error',message:String(m.message||'Duck.ai could not complete this request.').slice(0,500)});return{ok:true};}
}
chrome.runtime.onMessage.addListener((m,s,reply)=>{handle(m,s).then(r=>reply(r||{ok:true})).catch(e=>reply({error:e.message}));return true;});
chrome.alarms.onAlarm.addListener(async a=>{if(!a.name.startsWith('duck:'))return;const j=await get(a.name.slice(5));if(!j)return;
 if(j.finished){await closeTab(j);await drop(j);return;}
 await finish(j,'error',{type:'error',message:'Duck.ai request timed out. Open the Duck.ai tab to check for a sign-in, terms or verification screen, then retry.'});});
chrome.tabs.onRemoved.addListener(async id=>{for(const j of await jobs()){
 if(j.owner===id){j.owner=-1;await closeTab(j);await drop(j);}
 else if(j.tab===id&&!j.finished)await finish(j,'error',{type:'error',message:'The Duck.ai tab closed before the reply was received.'});}});
chrome.webNavigation.onErrorOccurred.addListener(async d=>{if(d.frameId!==0)return;for(const j of await jobs())if(j.tab===d.tabId&&!j.finished&&!j.submitted)await finish(j,'error',{type:'error',message:'Duck.ai could not load: '+d.error});});
