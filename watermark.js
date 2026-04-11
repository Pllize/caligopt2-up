/* ══════════════════════════════════
   WATERMARK.JS — CaligoPt2
   Canvas 렌더링으로 원본 URL 완전 차단
   LRU 캐시로 성능 최적화
══════════════════════════════════ */
(function(){
  const CACHE = new Map();
  const MAX_CACHE = 300;
  const WM_TEXT = 'CaligoPt2';
  const WM_OPACITY = 0.13;
  const WM_FONT_SIZE = 9;
  const WM_SPACING_X = 52;
  const WM_SPACING_Y = 28;
  const WM_ANGLE = -22;

  function evict(){ if(CACHE.size>=MAX_CACHE){ CACHE.delete(CACHE.keys().next().value); } }

  function drawWatermark(ctx, w, h){
    ctx.save();
    ctx.globalAlpha = WM_OPACITY;
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${WM_FONT_SIZE}px Outfit,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rad = WM_ANGLE * Math.PI / 180;
    const diag = Math.sqrt(w*w+h*h);
    const cols = Math.ceil(diag/WM_SPACING_X)+2;
    const rows = Math.ceil(diag/WM_SPACING_Y)+2;
    ctx.translate(w/2, h/2);
    ctx.rotate(rad);
    for(let r=-rows;r<=rows;r++){
      for(let c=-cols;c<=cols;c++){
        ctx.fillText(WM_TEXT, c*WM_SPACING_X+(r%2===0?0:WM_SPACING_X/2), r*WM_SPACING_Y);
      }
    }
    ctx.restore();
  }

  // img 엘리먼트를 canvas로 교체 (핵심 함수)
  function applyImg(imgEl, style){
    if(!imgEl || imgEl.dataset.wm==='1') return;
    imgEl.dataset.wm = '1';

    const doRender = ()=>{
      const w = imgEl.naturalWidth  || 300;
      const h = imgEl.naturalHeight || 420;
      const src = imgEl.src;

      const render = (dataUrl)=>{
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        // 원본 img와 같은 style 유지
        if(style){
          canvas.style.cssText = style;
        } else {
          canvas.style.cssText = imgEl.style.cssText ||
            'width:100%;height:100%;object-fit:cover;display:block';
          if(imgEl.className) canvas.className = imgEl.className;
        }
        const ctx = canvas.getContext('2d');
        const tmp = new Image();
        tmp.onload = ()=>{
          ctx.drawImage(tmp, 0, 0, w, h);
          drawWatermark(ctx, w, h);
        };
        tmp.src = dataUrl;
        // 우클릭 차단
        canvas.addEventListener('contextmenu', e=>e.preventDefault());
        imgEl.replaceWith(canvas);
        evict(); CACHE.set(src, dataUrl);
      };

      if(CACHE.has(src)){ render(CACHE.get(src)); return; }
      // crossOrigin 재로딩으로 canvas taint 방지
      const loader = new Image();
      loader.crossOrigin = 'anonymous';
      loader.onload = ()=>{
        const tmp2 = document.createElement('canvas');
        tmp2.width = loader.naturalWidth; tmp2.height = loader.naturalHeight;
        const ctx2 = tmp2.getContext('2d');
        ctx2.drawImage(loader, 0, 0);
        drawWatermark(ctx2, tmp2.width, tmp2.height);
        const url = tmp2.toDataURL('image/jpeg', 0.92);
        render(url);
      };
      loader.onerror = ()=>{}; // 실패 시 원본 유지
      loader.src = src + (src.includes('?')?'&':'?') + '_wm=1';
    };

    if(imgEl.complete && imgEl.naturalWidth){ doRender(); }
    else { imgEl.addEventListener('load', doRender, {once:true}); }
  }

  // 컨테이너(.pci 등) 안의 img에 적용
  function applyToContainer(container){
    if(!container || container.dataset.wm==='1') return;
    const img = container.querySelector('img');
    if(!img) return;
    container.dataset.wm = '1';
    applyImg(img);
  }

  // 전체 스캔
  function scanAll(){
    document.querySelectorAll('.pci, .fs-img-wrap').forEach(c=>{
      if(c.dataset.wm==='1') return;
      applyToContainer(c);
    });
    // fs-img 내부도 직접 처리
    const fsImg = document.getElementById('fs-img');
    if(fsImg){ const img=fsImg.querySelector('img'); if(img&&img.dataset.wm!=='1') applyImg(img); }
  }

  // MutationObserver
  const observer = new MutationObserver(muts=>{
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node.nodeType!==1) continue;
        const containers = (node.classList&&(node.classList.contains('pci')||node.classList.contains('fs-img-wrap')))
          ? [node]
          : [...node.querySelectorAll('.pci, .fs-img-wrap')];
        containers.forEach(applyToContainer);
        // fs-img 직접 추가된 경우
        if(node.id==='fs-img'||node.closest&&node.closest('#fs-img')){
          const img=node.tagName==='IMG'?node:node.querySelector('img');
          if(img&&img.dataset.wm!=='1') applyImg(img);
        }
      }
    }
  });

  if(document.body){
    observer.observe(document.body, {childList:true, subtree:true});
  } else {
    document.addEventListener('DOMContentLoaded', ()=>{
      observer.observe(document.body, {childList:true, subtree:true});
    });
  }

  window.WM = { apply: applyToContainer, applyImg, get: ()=>{}, cache: CACHE, scanAll };
})();
