/* Optional adapter for any Tabbed app. File bytes stay between the two browser windows. */
(function(){
 'use strict';
 let busy=false;
 function organizerUrl(){const u=new URL(localStorage.getItem('tabbed.organizerUrl')||'https://tabbedorganizer.pages.dev/');if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Organizer must use HTTPS.');u.hash='';return u;}
 function send(exportFile){
  if(busy)return Promise.reject(Error('A Save to Organizer request is already open.'));
  let url;try{url=organizerUrl();}catch(e){return Promise.reject(e);}
  const channel=crypto.randomUUID();url.hash=new URLSearchParams({organizerReceive:channel,from:location.origin}).toString();
  const win=window.open(url.href,'_blank','popup=yes,width=1220,height=850');
  if(!win)return Promise.reject(Error('Allow popups for this app, then try Save to Organizer again.'));
  busy=true;
  let exported;try{exported=Promise.resolve(exportFile());}catch(e){exported=Promise.reject(e);}exported.catch(()=>{});
  return new Promise((resolve,reject)=>{
   let sent=false,done=false;
   function finish(error,value){if(done)return;done=true;busy=false;clearTimeout(timer);clearInterval(watch);window.removeEventListener('message',onMessage);error?reject(error):resolve(value);}
   const timer=setTimeout(()=>finish(Error('Organizer did not complete the save. Check its address, keep both windows open, and try again.')),300000);
   const watch=setInterval(()=>{if(win.closed)finish(Error('The Organizer window was closed before saving.'));},1000);
   async function onMessage(e){const m=e.data;if(e.source!==win||e.origin!==url.origin||m?.protocol!=='tabbed-organizer-v1'||m.channel!==channel)return;
    if(m.type==='ready'&&!sent){sent=true;try{const file=await exported;if(!file||!(file.blob instanceof Blob)||!file.blob.size)throw Error('There is no file to save.');win.postMessage({protocol:'tabbed-organizer-v1',channel,type:'file',name:file.name||'Untitled',file:file.blob,folder:file.folder||'',date:file.date||''},url.origin);}catch(error){finish(error);}}
    if(m.type==='saved')finish(null,m);if(m.type==='cancelled')finish(Error('Save to Organizer cancelled.'));if(m.type==='error')finish(Error(m.error||'Organizer could not save the file.'));
   }
   window.addEventListener('message',onMessage);
  });
 }
 function install(options){
  const host=document.querySelector(options.host);if(!host)return;
  const wrap=document.createElement('span');wrap.className='organizer-send-control';
  const button=document.createElement('button');button.type='button';button.textContent='Save to Organizer';button.title='Choose an Organizer folder and optional calendar day';button.className='organizer-send-button';
  const settings=document.createElement('button');settings.type='button';settings.textContent='⚙';settings.className='organizer-send-settings';settings.setAttribute('aria-label','Set Organizer address');
  const message=document.createElement('span');message.className='organizer-send-status';message.setAttribute('role','status');
  button.onclick=async()=>{button.disabled=true;message.textContent='Choose a folder and day in Organizer…';try{const result=await send(options.exportFile);message.textContent='Saved: '+result.name+(result.date?' · '+result.date:'');}catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
  settings.onclick=()=>{const value=prompt('Your deployed Organizer URL',localStorage.getItem('tabbed.organizerUrl')||'https://tabbedorganizer.pages.dev/');if(!value)return;try{const u=new URL(value);if(u.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Use an HTTPS URL.');localStorage.setItem('tabbed.organizerUrl',u.href);message.textContent='Organizer address saved.';}catch(error){message.textContent=error.message;}};
  wrap.append(button,settings,message);host.append(wrap);
  const style=document.createElement('style');style.textContent='.organizer-send-control{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;margin-left:8px}.organizer-send-button,.organizer-send-settings{font:600 12px system-ui!important;min-height:32px!important;padding:6px 10px!important;border:1px solid #a9c9b6!important;border-radius:6px!important;background:#edf7f0!important;color:#24543b!important;cursor:pointer}.organizer-send-status{font:10px system-ui;color:inherit;max-width:210px;white-space:normal}.organizer-send-button:disabled{opacity:.5}@media(max-width:700px){.organizer-send-status{max-width:150px}.organizer-send-button{font-size:11px!important}}';document.head.append(style);
 }
 window.TabbedOrganizerClient={send,install};
})();
/* Bidirectional picker and compact green toolbar controls. */
(function(){
 const C=window.TabbedOrganizerClient,connections=new Map();
 const svgOpen='<path d="M3 7h7l2 2h9l-3 11H3z"/><path d="M12 3v10m-3-3 3 3 3-3"/>';
 const svgSave='<path d="M5 3h12l3 3v15H4V3zM8 3v6h8V3M8 21v-7h8v7"/>';
 function address(){const u=new URL(localStorage.getItem('tabbed.organizerUrl')||'https://tabbedorganizer.pages.dev/');if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use an HTTPS Organizer address.');u.hash='';return u;}
 C.configure=function(){const value=prompt('Your deployed Organizer URL',localStorage.getItem('tabbed.organizerUrl')||'https://tabbedorganizer.pages.dev/');if(value){const u=new URL(value);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Use HTTPS.');localStorage.setItem('tabbed.organizerUrl',u.href);}};
 function patchLinks(){const L=window.TabbedLink;if(!L||L.organizerPickerPatched)return;const oldAvailable=L.available,oldSave=L.saveBack;L.organizerPickerPatched=true;
 L.available=function(link){if(link?.organizerPeer){const c=connections.get(link.organizerPeer);return !!c&&!c.win.closed;}return oldAvailable(link);};
 L.saveBack=function(link,blob,name){if(!link?.organizerPeer)return oldSave(link,blob,name);const c=connections.get(link.organizerPeer);if(!c||c.win.closed)return Promise.resolve({ok:false,error:'The Organizer picker window is closed. Use Save to Organizer to create another copy.'});
  const req=crypto.randomUUID();return new Promise(resolve=>{const timer=setTimeout(()=>{c.waiting.delete(req);resolve({ok:false,error:'Organizer did not confirm the save.'});},30000);c.waiting.set(req,r=>{clearTimeout(timer);resolve(r);});c.win.postMessage({protocol:'tabbed-organizer-v1',channel:c.channel,type:'update',req,id:link.id,name:name||link.name,file:blob},c.origin);});};
 }
 C.pick=function(options){patchLinks();let u;try{u=address();}catch(e){return Promise.reject(e);}const channel=crypto.randomUUID();u.hash=new URLSearchParams({organizerPick:channel,from:location.origin,app:options.app}).toString();const win=window.open(u.href,'_blank','popup=yes,width=1220,height=850');if(!win)return Promise.reject(Error('Allow popups to open Organizer.'));
 const connection={win,origin:u.origin,channel,waiting:new Map()};connections.set(channel,connection);
 return new Promise((resolve,reject)=>{let done=false,loading=false;const timer=setTimeout(()=>finish(Error('Organizer did not open a file. Check the address or choose a file again.')),300000);const watch=setInterval(()=>{if(win.closed&&!done)finish(Error('The Organizer picker was closed.'));},1000);
  function finish(error,value){clearInterval(watch);clearTimeout(timer);if(done)return;done=true;if(error){window.removeEventListener('message',receive);connections.delete(channel);reject(error);}else resolve(value);}
  async function receive(e){const m=e.data;if(e.source!==win||e.origin!==u.origin||m?.protocol!=='tabbed-organizer-v1'||m.channel!==channel)return;
   if(m.type==='updated'){const waiter=connection.waiting.get(m.req);if(waiter){connection.waiting.delete(m.req);waiter({ok:!!m.ok,name:m.name,error:m.error});}return;}
   if(m.type==='cancelled'&&!done)return finish(Error('Open from Organizer cancelled.'));
   if(m.type!=='picked'||loading||done||!(m.file instanceof Blob)||typeof m.id!=='string'||typeof m.name!=='string')return;
   loading=true;const link={id:m.id,name:m.name,origin:u.origin,organizerPeer:channel};try{const result=await options.openFile(new File([m.file],m.name,{type:m.file.type}),link);if(result===false||result===null)throw Error('The app could not open that file.');win.postMessage({protocol:'tabbed-organizer-v1',channel,type:'opened'},u.origin);finish(null,{name:m.name,id:m.id});}catch(error){win.postMessage({protocol:'tabbed-organizer-v1',channel,type:'open-error',error:error.message},u.origin);loading=false;}
  }
  window.addEventListener('message',receive);
 });};
 C.installToolbar=function(options){const anchor=document.querySelector(options.after);if(!anchor)throw Error('The Google Drive toolbar anchor was not found.');patchLinks();const scope=anchor.parentElement;const existing=scope?Array.from(scope.querySelectorAll('.org-toolbar-pair')):[];const controls=existing.length?existing[existing.length-1]:document.createElement('span');existing.forEach(p=>{if(p!==controls)p.remove();});controls.className='org-toolbar-pair';controls.id='organizer-toolbar-commands';controls.replaceChildren();
  const status=document.createElement('div');status.className='org-transfer-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);let hideTimer;
  const show=text=>{clearTimeout(hideTimer);status.textContent=text;status.hidden=false;hideTimer=setTimeout(()=>{status.hidden=true;},12000);};
  const runOpen=async()=>{try{show('Choose a file in Organizer…');const r=await C.pick(options);show('Opened '+r.name+' from Organizer');}catch(e){show(e.message);}};
  const runSave=async()=>{try{show('Choose a folder and day in Organizer…');const r=await C.send(options.exportFile);show('Saved '+r.name+' to Organizer');}catch(e){show(e.message);}};
  for(const [action,label,paths,handler]of[['open','Open from Organizer',svgOpen,runOpen],['save','Save to Organizer',svgSave,runSave]]){const b=document.createElement('button');b.type='button';b.className='org-toolbar-icon';b.dataset.organizerCommand=action;b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+paths+'</svg>';b.onclick=handler;b.oncontextmenu=e=>{e.preventDefault();try{C.configure();}catch(error){show(error.message);}};controls.append(b);}
  if(anchor.nextElementSibling!==controls)anchor.after(controls);
  const style=document.createElement('style');style.textContent='#sl-titlebar,#tw-titlebar,#titlebar{height:auto;min-height:42px}#sl-qat,.qat{flex-wrap:wrap}#sl-qat{overflow:visible}.org-toolbar-pair{display:inline-flex!important;align-items:center;gap:2px;flex:none!important;vertical-align:middle}.org-toolbar-icon{display:inline-grid!important;place-items:center;width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important;padding:4px!important;border:1px solid transparent!important;border-radius:6px!important;background:transparent!important;color:#167547!important;cursor:pointer;flex:none}.org-toolbar-icon:hover{background:#e0f1e6!important;border-color:#9ac6ac!important}.org-toolbar-icon:focus-visible{outline:2px solid #167547;outline-offset:1px}.org-toolbar-icon svg{width:20px!important;height:20px!important;stroke:#167547!important}.org-transfer-status{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:10000;padding:12px 18px;border:1px solid #a9cbb6;background:#edf7f0;color:#204e36;box-shadow:0 6px 25px #102e2020;border-radius:8px;max-width:min(600px,90vw);font:12px/1.5 system-ui}.org-transfer-status[hidden]{display:none!important}';document.head.append(style);
  window.TabbedOrganizerActions={open:runOpen,save:runSave,configure:C.configure};return window.TabbedOrganizerActions;
 };
})();
