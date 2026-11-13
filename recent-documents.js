/* Recent documents: ten device-local snapshots, with original local handles when available. */
(function(){
 'use strict';
 let queue=Promise.resolve(), reopening=false;
 function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('tabbedword-recent',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function transaction(mode,fn){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('documents',mode),result=fn(tx.objectStore('documents'));tx.oncomplete=()=>{db.close();resolve(result?.result)};tx.onerror=()=>{db.close();reject(tx.error)};});}
 function remember(opened){
  if(reopening)return;
  let d;try{syncDoc();d=activeDoc();}catch(e){return}if(!d)return;
  const snapshot={...d};delete snapshot.link;
  let copy;try{copy=structuredClone(snapshot)}catch(e){return}
  queue=queue.catch(()=>{}).then(async()=>{
   const old=await transaction('readonly',st=>st.get(copy.id));
   if(!opened&&!old)return;
   await transaction('readwrite',st=>st.put({id:copy.id,name:copy.name,openedAt:opened?Date.now():old.openedAt,snapshot:copy}));
   const all=await transaction('readonly',st=>st.getAll());all.sort((a,b)=>b.openedAt-a.openedAt);
   if(all.length>10)await transaction('readwrite',st=>{all.slice(10).forEach(r=>st.delete(r.id));});
  }).catch(()=>{status('Recent documents could not be stored on this device.');});
 }
 const baseSwitch=switchDoc;switchDoc=function(){remember(false);const r=baseSwitch.apply(this,arguments);remember(true);return r;};
 const basePersist=persistDrafts;persistDrafts=function(){const r=basePersist.apply(this,arguments);remember(false);return r;};
 window.twShowRecent=async function(){
  await queue;let rows;try{rows=await transaction('readonly',st=>st.getAll())}catch(e){status('Recent documents are unavailable on this device.');return}
  rows.sort((a,b)=>b.openedAt-a.openedAt);
  const dlg=document.createElement('dialog');dlg.className='tw-recent-dialog';dlg.setAttribute('aria-label','Recent documents');
  const heading=document.createElement('h2');heading.textContent='Recent documents';dlg.append(heading);
  const hint=document.createElement('p');hint.textContent='Last 10 opened on this browser. Closed documents reopen from their latest local copy.';dlg.append(hint);
  if(!rows.length){const empty=document.createElement('p');empty.textContent='Documents you open will appear here.';dlg.append(empty);}
  rows.forEach(rec=>{const b=document.createElement('button');b.type='button';b.className='tw-recent-item';const name=document.createElement('strong');name.textContent=rec.name||'Untitled document';const date=document.createElement('small');date.textContent=new Date(rec.openedAt).toLocaleString();b.append(name,date);b.onclick=()=>{
   dlg.close();const existing=docs.find(d=>d.id===rec.id);if(existing){switchDoc(existing.id);return}
   reopening=true;try{const d=structuredClone(rec.snapshot);delete d.link;d.dirty=true;addDoc(d);}finally{reopening=false}remember(true);persistDrafts();status('Reopened '+rec.name+' · latest local copy');
  };dlg.append(b);});
  const actions=document.createElement('div');actions.className='tw-recent-actions';const clear=document.createElement('button');clear.textContent='Clear recent list';clear.onclick=async()=>{try{await queue;await transaction('readwrite',st=>st.clear());dlg.close();}catch(e){status('Could not clear recent documents.')}};const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dlg.close();actions.append(clear,close);dlg.append(actions);dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
 };
 const menu=(window.twMenus||[]).find(m=>m.name==='File');if(menu)menu.items.splice(0,0,{label:'Recent documents…',act:window.twShowRecent});
})();
