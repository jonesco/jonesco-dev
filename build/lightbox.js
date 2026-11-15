(function(){
  var lb=document.getElementById('lb'),img=document.getElementById('lbimg'),info=document.getElementById('lbinfo'),last=null;
  function open(src,alt,btn){
    last=btn;img.alt=alt;img.removeAttribute('width');img.src=src;
    img.onload=function(){
      // natural pixels divided by the screen's pixel ratio: one image pixel per device pixel
      var r=window.devicePixelRatio||1;
      img.style.width=(img.naturalWidth/r)+'px';
      info.textContent=alt+' · '+img.naturalWidth+' × '+img.naturalHeight+' px';
    };
    lb.hidden=false;lb.classList.add('open');lb.scrollTop=0;lb.scrollLeft=0;document.body.style.overflow='hidden';
  }
  function close(){lb.classList.remove('open');lb.hidden=true;document.body.style.overflow='';if(last)last.focus();}
  document.querySelectorAll('.zoom').forEach(function(b){
    b.addEventListener('click',function(){var i=b.querySelector('img');open(i.dataset.full||i.src,i.alt,b);});
  });
  lb.addEventListener('click',function(e){if(e.target!==img)close();});
  document.getElementById('lbclose').addEventListener('click',close);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open'))close();});
})();
