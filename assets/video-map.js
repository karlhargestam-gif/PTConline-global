// Swaps English video URLs for dubbed Portuguese versions when available.
// Edit /assets/video-map.pt.json: set "pt" for a key to the dubbed URL. Leave null to keep English.
(function(){
  var lang=(document.documentElement.lang||'').toLowerCase();
  if(lang.indexOf('pt')!==0) return;
  fetch('/assets/video-map.pt.json').then(function(r){return r.ok?r.json():{}}).then(function(map){
    document.querySelectorAll('[data-video-key]').forEach(function(el){
      var e=map[el.getAttribute('data-video-key')]; if(!e||!e.pt) return;
      if(el.tagName==='VIDEO'){el.src=e.pt;} else {el.href=e.pt;}
      el.setAttribute('data-video-lang','pt');
    });
  }).catch(function(){});
})();
