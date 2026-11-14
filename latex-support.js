/* LaTeX source files and structured-document export. No compilation or network calls. */
(function(root){
'use strict';
const escape=text=>String(text??'').replace(/[\\{}$&#%_^~]/g,c=>({'\\':'\\textbackslash{}','{':'\\{','}':'\\}','$':'\\$','&':'\\&','#':'\\#','%':'\\%','_':'\\_','^':'\\textasciicircum{}','~':'\\textasciitilde{}'}[c]));
function template(){return '% Compile with XeLaTeX or LuaLaTeX.\n\\documentclass[12pt]{article}\n\\usepackage{fontspec}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath,amssymb}\n\\usepackage{hyperref}\n\\title{New document}\n\\author{}\n\\date{}\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\nWrite your text here.\n\n\\end{document}\n';}
function build(doc,{images=false}={}){
 if(doc.kind==='tex')return {text:doc.body,assets:[]};
 if(doc.kind==='html')throw Error('Convert HTML to a text document before exporting it as LaTeX.');
 const text=String(doc.body||''),flags=new Uint16Array(text.length),assets=[];
 for(const r of doc.fmt||[])for(let i=Math.max(0,r.s);i<Math.min(text.length,r.e);i++)flags[i]|=r.f;
 const notes=(doc.notes||[]).filter(n=>n.marker),links=(doc.links||[]).filter(l=>Number.isInteger(l.s)&&Number.isInteger(l.e));
 function inline(value,offset=0,format=true){let out='',i=0;
  while(i<value.length){
   const note=notes.find(n=>value.startsWith(n.marker,i));if(note){out+='\\footnote{'+escape(note.text)+'}';i+=note.marker.length;continue;}
   const math=/^(\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/.exec(value.slice(i));if(math){out+=math[0];i+=math[0].length;continue;}
   const link=format&&links.find(l=>l.s===offset+i&&l.e<=offset+value.length&&/^(https?:|mailto:)/i.test(l.url||l.href||''));
   if(link){out+='\\href{'+escape(link.url||link.href)+'}{'+escape(value.slice(i,link.e-offset))+'}';i=link.e-offset;continue;}
   const f=format?flags[offset+i]||0:0;let end=i+1;
   while(end<value.length&&(format?(flags[offset+end]||0):0)===f&&!/[$\\⁽]/.test(value[end])&&!links.some(l=>l.s===offset+end))end++;
   let part=escape(value.slice(i,end));if((f&2)&&!(f&8))part='\\textit{'+part+'}';if((f&1)&&!(f&4))part='\\textbf{'+part+'}';out+=part;i=end;
  }return out;
 }
 const lines=text.split('\n'),body=[];let offset=0,list=null;
 const close=()=>{if(list){body.push('\\end{'+list+'}');list=null;}};
 for(let n=0;n<lines.length;n++){
  const line=lines[n],meta=doc.blocks?.[n]||{},obj=meta.obj;
  if(obj){close();
   if(obj.type==='pagebreak')body.push('\\newpage');
   else if(obj.type==='table'){
    const cells=obj.cells||[],cols=Math.max(1,...cells.map(r=>r.length));
    body.push('\\begin{tabularx}{\\linewidth}{|*{'+cols+'}{X|}}','\\hline');
    for(const row of cells)body.push(Array.from({length:cols},(_,i)=>escape(row[i]??'').replace(/\n/g,'\\newline ')).join(' & ')+' \\\\ \\hline');
    body.push('\\end{tabularx}','');
   }else if(obj.type==='image'){
    const match=/^data:image\/(png|jpeg);base64,([\s\S]+)$/.exec(obj.src||'');
    if(images&&match){const path='assets/image-'+String(assets.length+1).padStart(3,'0')+'.'+(match[1]==='jpeg'?'jpg':'png');assets.push({path,base64:match[2]});body.push('\\begin{center}','\\includegraphics[width='+Math.max(.1,Math.min(6.2,(Number(obj.w)||480)/96)).toFixed(2)+'in,height=0.8\\textheight,keepaspectratio]{'+path+'}','\\end{center}');}
    else body.push('\\begin{quote}\\textit{'+escape('Image: '+(obj.alt||'embedded image')+(images?' (image format not supported by this export)':' (use the ZIP export to include PNG/JPEG assets)'))+'}\\end{quote}');
   }else body.push('% Unsupported object: '+String(obj.type||'unknown').replace(/[\r\n]/g,' '));
  }else if(meta.list){const wanted=meta.list==='number'?'enumerate':'itemize';if(list!==wanted){close();list=wanted;body.push('\\begin{'+list+'}');}body.push('\\item '+inline(line,offset));}
  else{close();const content=inline(line,offset),heading={heading1:'section',heading2:'subsection',heading3:'subsubsection'}[meta.style];
   if(heading)body.push('\\'+heading+'{'+content+'}');else if(meta.style==='quote')body.push('\\begin{quote}'+content+'\\end{quote}');else if(meta.style==='title')body.push('\\section*{'+content+'}');else body.push(content,'');
  }offset+=line.length+1;
 }close();
 const header='% Exported by TabbedWord. Compile with XeLaTeX or LuaLaTeX.\n\\documentclass[12pt]{article}\n\\usepackage{fontspec}\n\\usepackage[margin=1in]{geometry}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx,tabularx}\n\\usepackage{hyperref}\n'+(doc.title?'\\title{'+escape(doc.title)+'}\n\\author{}\n\\date{}\n':'')+'\\begin{document}\n'+(doc.title?'\\maketitle\n':'');
 return {text:header+body.join('\n')+'\n\\end{document}\n',assets};
}
function init(){
 const menu=(window.twMenus||[]).find(m=>m.name==='File');if(!menu)return;
 function current(){if(typeof busy!=='undefined'&&busy)throw Error('Finish the current operation first.');syncDoc();const d=activeDoc();if(!d)throw Error('Open a document first.');if(d.trk||(d.fmt||[]).some(r=>typeof REV_DEL!=='undefined'&&(r.f&REV_DEL)))throw Error('Accept or reject tracked changes before exporting a formatted document to LaTeX.');return d;}
 function openFile(){const input=document.createElement('input');input.type='file';input.accept='.tex,.ltx,.latex,application/x-tex,text/x-tex';input.multiple=true;input.onchange=()=>guard(async()=>{for(const file of input.files)await load(file,null);});input.click();}
 function newFile(){if(busy)return;window.twNewKind('tex');status('New LaTeX source document · Save writes .tex');}
 function exportDialog(){let d;try{d=current();}catch(e){status(e.message);return;}
  const dialog=document.createElement('dialog');dialog.className='tw-recent-dialog';dialog.setAttribute('aria-labelledby','latex-export-title');
  const heading=document.createElement('h2');heading.id='latex-export-title';heading.textContent='Export LaTeX';
  const note=document.createElement('p');note.textContent=d.kind==='tex'?'Save or export the current LaTeX source unchanged.':'Creates LaTeX source with headings, lists, basic bold/italic, links, footnotes, tables and inline math. Choose ZIP to include embedded PNG/JPEG images. Complex page layout may differ. Compile externally with XeLaTeX or LuaLaTeX.';
  const choice=document.createElement('select');choice.setAttribute('aria-label','LaTeX output');for(const [v,t]of [['tex','LaTeX source (.tex)'],['zip','LaTeX with image assets (.zip)'],['tab','Open LaTeX source in a new tab']]){const o=document.createElement('option');o.value=v;o.textContent=t;choice.append(o);}
  const actions=document.createElement('div');actions.className='tw-recent-actions';const cancel=document.createElement('button');cancel.textContent='Cancel';cancel.onclick=()=>dialog.close();const saveButton=document.createElement('button');saveButton.textContent='Export';saveButton.className='primary';actions.append(cancel,saveButton);dialog.append(heading,note,choice,actions);
  saveButton.onclick=async()=>{saveButton.disabled=true;cancel.disabled=true;try{
   const result=build(d,{images:choice.value==='zip'}),base=d.name.replace(/\.[^.]+$/,'')||'Document';
   if(choice.value==='tab'){const out=makeDoc(base+'.tex','',result.text,null,true);out.autoName=false;addDoc(out);queueDraft();}
   else if(choice.value==='zip'){const z=new JSZip();z.file(base+'.tex',result.text);for(const asset of result.assets)z.file(asset.path,asset.base64,{base64:true});z.file('README.txt','Compile the .tex file with XeLaTeX or LuaLaTeX from this directory. Keep the assets folder beside it.\n');downloadLocal(await z.generateAsync({type:'blob'}),base+' - LaTeX.zip');}
   else downloadLocal(new Blob([result.text],{type:'application/x-tex;charset=utf-8'}),base+'.tex');
   dialog.close();status('LaTeX source created · original document kept');
  }catch(e){note.textContent=e.message;}finally{saveButton.disabled=false;cancel.disabled=false;}};
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 menu.items.push({label:'Create .tex (LaTeX)',act:newFile},{label:'Open LaTeX…',act:openFile},{label:'Export LaTeX…',act:exportDialog});
 const about=document.querySelector('.tw-about-sec[data-sec=about]');if(about){const p=document.createElement('p');p.textContent='New in 2026.11.72: create/open/save LaTeX source (.tex, .ltx, .latex), export formatted documents as .tex or a ZIP with image assets, and open exported source in a new tab. Compilation uses an external TeX installation.';about.prepend(p);}
 root.TwLatex.open=openFile;root.TwLatex.create=newFile;root.TwLatex.export=exportDialog;
}
root.TwLatex={escape,template,build};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
