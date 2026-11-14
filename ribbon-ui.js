/* Preserve the existing style commands and selection handling in a compact Styles menu. */
(function () {
  function init() {
    var gallery = document.querySelector('#tw-ribbon .tw-gallery');
    if (!gallery) return;
    var group = gallery.closest('.tw-group');
    var menu = document.createElement('div');
    menu.id = 'tw-style-menu'; menu.setAttribute('popover', 'auto');
    menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'Paragraph styles');
    var button = document.createElement('button');
    button.type = 'button'; button.className = 'tw-big'; button.title = 'Styles';
    button.setAttribute('aria-label', 'Styles');button.setAttribute('aria-haspopup', 'true');button.setAttribute('aria-controls', menu.id);button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 9 3l6 15M5 13h8"/><path d="m13 19 6-8 3 2-6 8-4 1z" stroke="#2381c4"/><path d="m19 11 3 2"/></svg><span class="tw-lbl">Styles ▾</span>';
    gallery.before(button);menu.append(gallery);document.body.append(menu);
    function place() {
      var r=button.getBoundingClientRect();
      menu.style.left=Math.max(12,Math.min(r.left,innerWidth-menu.offsetWidth-12))+'px';
      menu.style.top=Math.min(r.bottom+6,Math.max(12,innerHeight-menu.offsetHeight-12))+'px';
    }
    button.addEventListener('click',function(){if(menu.matches(':popover-open'))menu.hidePopover();else{menu.showPopover();place();}});
    menu.addEventListener('toggle',function(){button.setAttribute('aria-expanded',String(menu.matches(':popover-open')));});
    menu.addEventListener('click',function(e){if(e.target.closest('.tw-st')){menu.hidePopover();}});
    window.addEventListener('resize',function(){if(menu.matches(':popover-open'))place();});
    document.getElementById('tw-tabrow').addEventListener('click',function(){if(menu.matches(':popover-open'))menu.hidePopover();});
    group.setAttribute('aria-label','Styles');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

/* View: illustrated native selectors retain keyboard, touch and saved preferences. */
(function () {
  function initReadingIcons() {
    var specs = [
      {id:'readfont', label:'Reading font', icon:'<path d="M3 5c3-1 6 0 9 2v14c-3-2-6-3-9-2z" fill="#e4efff" stroke="#3972b6"/><path d="M21 5c-3-1-6 0-9 2v14c3-2 6-3 9-2z" fill="#e4f7f4" stroke="#22978e"/><path d="M6 9l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1" stroke="#3972b6"/>'},
      {id:'readsize', label:'Text size', icon:'<circle cx="10" cy="10" r="7" fill="#e4efff" stroke="#3972b6"/><path d="m15 15 6 6" stroke="#22978e" stroke-width="3"/><path d="m6.5 13 3.5-7 3.5 7m-5.8-2h4.6" stroke="#3972b6"/>'}
    ];
    specs.forEach(function(spec) {
      var select=document.getElementById(spec.id);
      if(!select || !select.closest('#tw-ribbon'))return;
      var wrap=select.closest('.tw-selwrap');
      if(!wrap || wrap.classList.contains('tw-reading-choice'))return;
      wrap.classList.add('tw-reading-choice');
      var face=document.createElement('div');face.className='tw-reading-face';face.setAttribute('aria-hidden','true');
      face.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+spec.icon+'</svg><span>'+spec.label+' <span class="tw-reading-arrow">▾</span></span>';
      wrap.prepend(face);select.setAttribute('aria-label',spec.label);
      function sync(){var option=select.options[select.selectedIndex];var title=spec.label+': '+(option?option.textContent:'');wrap.title=title;select.title=title;}
      select.addEventListener('change',sync);sync();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initReadingIcons);else initReadingIcons();
})();
