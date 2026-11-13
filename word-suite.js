/* Integrate with Word's current visible chrome, never the retired header. */
(function(){
 'use strict';
 const home=document.querySelector('#tw-ribbon .tw-panel[data-panel="home"]');
 const chrome=document.querySelector('#tw-chrome');
 const icon=chrome?.querySelector('.tw-qat .tw-appicon');
 if(!chrome||!window.TabbedOrganizerClient)return;
 const controls=TabbedOrganizerClient.installToolbar({app:'word',after:'#tw-titlebar [data-organizer-drive-save]',openFile:(file,link)=>window.twOpenFile(file,link),exportFile:async function(){
  if(busy)throw Error('Finish the current operation first.');syncDoc();const doc=activeDoc();if(!doc)throw Error('Open a document first.');return {blob:await exportCurrent(),name:doc.name||name||'Document'+formatInfo(doc.kind).extensions[0]};
 }});
 const file=(window.twMenus||[]).find(menu=>menu.name==='File');
 if(file){file.items=file.items.filter(item=>!String(item.label||'').includes('Organizer'));let at=file.items.findIndex(item=>/Google Drive/i.test(item.label||''));if(at<0)at=1;file.items.splice(at,0,{label:'Open from Organizer…',act:controls.open},{label:'Save to Organizer…',act:controls.save});}
 if(!icon)return;
 const launcher=document.createElement('button');launcher.type='button';launcher.id='tw-suite-launcher';launcher.className='tw-suite-launcher';launcher.setAttribute('aria-label','Open Tabbed Apps');launcher.setAttribute('aria-haspopup','dialog');launcher.title='Tabbed Apps';icon.replaceWith(launcher);launcher.append(icon);
 const apps=[
  {name:'Tabbed Organizer',description:'Files, notes & calendar',icon:'tabbed-organizer.svg',url:'https://tabbedorganizer.pages.dev/'},
  {name:'Tabbed Slides',description:'Presentations',icon:'tabbed-slides.svg',url:'https://tabbedslides.pages.dev/'},
  {name:'Tabbed PDF',description:'Read, edit & sign',icon:'tabbed-pdf.svg',url:'https://tabbedpdf.pages.dev/'},
  {name:'Tabbed Calendar',description:'Calendar & planning',icon:'tabbed-calendar.svg',url:'https://tabbedcalendar.pages.dev/'},
  {name:'Tabbed Entertainment',description:'TV & radio',icon:'tabbed-entertainment.svg',url:'https://tabbedentertainment.pages.dev/'}
 ];
 const dialog=document.createElement('dialog');dialog.id='tw-suite-dialog';dialog.setAttribute('aria-labelledby','tw-suite-title');
 dialog.innerHTML='<div class="tw-suite-head"><div><span>TABBED WORKSPACE</span><h2 id="tw-suite-title">Tabbed Apps</h2></div><button type="button" aria-label="Close Tabbed Apps" class="tw-suite-close">×</button></div><p class="tw-suite-intro">Your tools, together. Open another app in its own window.</p><div class="tw-suite-grid">'+apps.map((a,i)=>'<button type="button" class="tw-suite-card" data-word-suite="'+i+'"><img src="icons/'+a.icon+'" width="56" height="56" alt=""><strong>'+a.name+'</strong><span>'+a.description+'</span><small>Open window ↗</small></button>').join('')+'</div><div class="tw-suite-foot"><span>Keep Word open while you work across your apps.</span><button type="button" class="tw-suite-close">Close</button></div>';
 document.body.append(dialog);launcher.onclick=()=>dialog.showModal();dialog.querySelectorAll('.tw-suite-close').forEach(b=>b.onclick=()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target===dialog)return dialog.close();const button=event.target.closest('[data-word-suite]');if(!button)return;const app=apps[Number(button.dataset.wordSuite)];let url=app.url;
  if(app.name==='Tabbed Organizer'){try{const setting=localStorage.getItem('tabbed.organizerUrl');const custom=setting&&new URL(setting);if(custom&&(custom.protocol==='https:'||custom.protocol==='http:'&&['localhost','127.0.0.1'].includes(custom.hostname)))url=custom.href;}catch{}}
  window.open(url,'_blank','popup=yes,width=1280,height=900,noopener');dialog.close();
 });
})();
