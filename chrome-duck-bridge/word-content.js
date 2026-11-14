(()=>{'use strict';if(window.top!==window)return;let clicked=0;
window.addEventListener('click',e=>{if(e.isTrusted&&e.target.closest?.('#ai-duck-send'))clicked=Date.now();},true);
window.addEventListener('keydown',e=>{if(e.isTrusted&&(e.ctrlKey||e.metaKey)&&e.key==='Enter'&&e.target.closest?.('#ai-command'))clicked=Date.now();},true);
const emit=m=>window.postMessage({source:'TW_DUCK_EXTENSION_V140',...m},location.origin);
window.addEventListener('message',async e=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='TW_DUCK_APP_V140')return;const m=e.data;try{
 if(m.type==='ping'){const r=await chrome.runtime.sendMessage({type:'DUCK_CONNECTION'});emit({type:'connected',version:r?.version||'1.5.0'});return;}
 if(m.type==='start'){if(!clicked||Date.now()-clicked>1500)return;clicked=0;const r=await chrome.runtime.sendMessage({type:'DUCK_START',id:m.id,prompt:m.prompt});if(r?.error)emit({type:'error',id:m.id,message:r.error});}
 if(['received','cancel'].includes(m.type)){await chrome.runtime.sendMessage({type:'DUCK_'+m.type.toUpperCase(),id:m.id});}
}catch{emit({type:'error',id:m.id,message:'Duck bridge disconnected. Reload the updated Duck extension and TabbedWord.'});}});
chrome.runtime.onMessage.addListener(m=>{if(m.type==='DUCK_EVENT')emit(m.event);});emit({type:'connected',version:'1.5.0'});
})();
