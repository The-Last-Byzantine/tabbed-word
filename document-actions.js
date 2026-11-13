(function(){
 'use strict';
 document.addEventListener('pointerdown',e=>{if(e.button!==0||!e.target.closest('.tw-split-action'))return;rememberRichCaret();e.preventDefault();},true);
 window.twCombineTabs=function(){
  if(busy)return;syncDoc();
  const ordered=window.twSessionOrder?window.twSessionOrder():docs.slice();
  const eligible=ordered.filter(d=>d.kind!=='html'&&(d.title.trim()||d.body.trim()));
  if(eligible.length<2){status('Open at least two non-empty documents to combine.');return}
  const dlg=document.createElement('dialog');dlg.className='tw-recent-dialog';dlg.setAttribute('aria-label','Combine tabs');
  const h=document.createElement('h2');h.textContent='Combine tabs';const p=document.createElement('p');p.textContent='Choose documents in tab order. Each starts on a new page in a new combined tab. Original tabs stay open.';dlg.append(h,p);
  const choices=[];
  eligible.forEach(d=>{const label=document.createElement('label');label.style.cssText='display:flex;align-items:center;gap:10px;margin:12px 0';const check=document.createElement('input');check.type='checkbox';check.checked=true;check.style.width='auto';const text=document.createElement('span');text.textContent=d.name;label.append(check,text);dlg.append(label);choices.push({check,id:d.id})});
  const actions=document.createElement('div');actions.className='tw-recent-actions';const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dlg.close();const combine=document.createElement('button');combine.textContent='Combine';combine.className='primary';actions.append(cancel,combine);dlg.append(actions);
  combine.onclick=async()=>{const ids=choices.filter(c=>c.check.checked).map(c=>c.id);if(ids.length<2){p.textContent='Select at least two documents.';return}if(busy)return;busy=true;combine.disabled=true;cancel.disabled=true;
   try{const result=await window.twCompileSelected(ids);await load(new File([result.blob],'Combined document.docx',{type:result.blob.type}),null);const d=activeDoc();if(d){d.dirty=true;dirty=true;persistDrafts()}dlg.close();status('Combined '+result.count+' tabs · originals kept');}
   catch(e){p.textContent='Could not combine: '+e.message;}
   finally{busy=false;combine.disabled=false;cancel.disabled=false;}
  };
  dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal();
 };
})();
