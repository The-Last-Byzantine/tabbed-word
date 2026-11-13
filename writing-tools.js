/* Practical writing tools; all document edits use the editor's existing commands. */
(function(){
'use strict';
function init(){
 const main=document.querySelector('main'),bar=document.querySelector('.tw-titleright');if(!main||!bar)return;
 main.classList.add('writing-workspace');
 const left=document.getElementById('sectionrail');
 const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='tw-pill';b.textContent=label;b.onclick=fn;return b;};
 function leaveFocus(){if(document.body.classList.contains('focus-on')){document.getElementById('focusview')?.click();document.body.classList.remove('focus-on');}}
 const l=button('Show documents',()=>{const on=!main.classList.contains('show-left');main.classList.toggle('show-left',on);syncLeft();});
 l.id='writing-left-toggle';l.setAttribute('aria-controls','sectionrail');
 const r=button('Show tools',()=>{const sh=document.getElementById('shoulder');if(sh&&!sh.hidden)window.twShoulder?.close();else window.twShoulder?.open('folders');});
 r.id='writing-right-toggle';r.setAttribute('aria-controls','shoulder');
 const leftHeader=document.createElement('div');leftHeader.id='writing-left-header';leftHeader.className='writing-shoulder-header';leftHeader.append(l);
 const rightHeader=document.createElement('div');rightHeader.id='writing-right-header';rightHeader.className='writing-shoulder-header';rightHeader.append(r);
 main.append(leftHeader,rightHeader);
 function syncLeft(){const on=main.classList.contains('show-left');l.textContent=on?'‹ Hide documents':'› Show documents';l.setAttribute('aria-expanded',String(on));}
 syncLeft();
 const shoulder=document.getElementById('shoulder');
 function sync(){const on=shoulder&&!shoulder.hidden;main.classList.toggle('show-right',!!on);r.setAttribute('aria-expanded',String(!!on));r.textContent=on?'Hide tools ›':'Show tools ‹';}
 if(shoulder)new MutationObserver(sync).observe(shoulder,{attributes:true,attributeFilter:['hidden']});
 window.twShoulder?.close();sync();
 const dlg=document.createElement('dialog');dlg.id='writing-commands';dlg.setAttribute('aria-labelledby','writing-command-title');
 dlg.innerHTML='<div class="writing-dialog-head"><h2 id="writing-command-title">Commands</h2><button type="button" aria-label="Close commands">×</button></div><label for="writing-command-query">Find a command</label><input id="writing-command-query" type="search" placeholder="Try print, table, track changes…" autocomplete="off"><div class="writing-command-results"></div>';
 document.body.append(dlg);const input=dlg.querySelector('input'),results=dlg.querySelector('.writing-command-results');
 dlg.querySelector('button').onclick=()=>dlg.close();
 function commands(){let list=[];for(const menu of window.twMenus||[])for(const it of menu.items||[])if(!it.sep&&it.label&&(it.act||it.id))list.push({label:menu.name+' · '+it.label,run:()=>{if(it.act)it.act();else document.getElementById(it.id)?.click();},disabled:it.id?!!document.getElementById(it.id)?.disabled:false});return list;}
 function render(){results.replaceChildren();const q=input.value.toLocaleLowerCase();const matches=commands().filter(c=>c.label.toLocaleLowerCase().includes(q));for(const c of matches){const b=button(c.label,()=>{dlg.close();c.run();});b.disabled=c.disabled;results.append(b);}if(!matches.length)results.textContent='No matching commands.';}
 input.oninput=render;input.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();results.querySelector('button:not(:disabled)')?.focus();}if(e.key==='Enter'){e.preventDefault();results.querySelector('button:not(:disabled)')?.click();}};
 results.onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const bs=[...results.querySelectorAll('button:not(:disabled)')],i=bs.indexOf(document.activeElement);bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length]?.focus();};
 const open=()=>{if(dlg.open)return;input.value='';render();dlg.showModal();input.focus();};
 bar.prepend(button('Commands',open));
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();open();}});
 const stats=button('Writing statistics',()=>{update();statsDialog.showModal();});document.getElementById('statusbar')?.append(stats);
 const statsDialog=document.createElement('dialog');statsDialog.id='writing-statistics';statsDialog.innerHTML='<h2>Writing statistics</h2><p class="writing-stat-values"></p><p>Reading time is estimated at 200 words per minute.</p><button type="button">Close</button>';document.body.append(statsDialog);statsDialog.querySelector('button').onclick=()=>statsDialog.close();
 function count(t){return (t.match(/\S+/gu)||[]).length;}
 function update(){const b=document.getElementById('body');const text=b?.value||'';const words=count(text);const selection=window.getSelection()?.toString()||((document.activeElement===b)?text.slice(b.selectionStart,b.selectionEnd):'');stats.textContent=words.toLocaleString()+' words · '+Math.ceil(words/200)+' min read';stats.title='Show writing statistics';statsDialog.querySelector('.writing-stat-values').textContent=words.toLocaleString()+' words · '+text.length.toLocaleString()+' characters · '+text.replace(/\s/gu,'').length.toLocaleString()+' characters without spaces'+(selection?' · Selection: '+count(selection)+' words, '+selection.length+' characters':'');}
 let timer;function queue(){clearTimeout(timer);timer=setTimeout(update,180);}document.addEventListener('input',queue);document.addEventListener('selectionchange',queue);document.addEventListener('click',queue);update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
