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
        const x=c*WM_SPACING_X+(r%2===0?0:WM_SPACING_X/2);
        const y=r*WM_SPACING_Y;
        ctx.fillText(WM_TEXT,x,y);
      }
    }
    ctx.restore();
  }

  // src → dataURL (캐시 포함)
  function getWatermarked(src, cb){
    if(CACHE.has(src)){ cb(CACHE.get(src)); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth  || 300;
      canvas.height = img.naturalHeight || 420;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      drawWatermark(ctx, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.92);
      evict(); CACHE.set(src, url);
      cb(url);
    };
    img.onerror = ()=>cb(null);
    img.src = src;
  }

  // <canvas> 엘리먼트로 카드 이미지를 대체 렌더링
  // container: .pci 또는 .crd-img div
  function applyToContainer(container){
    if(!container || container.dataset.wm==='1') return;
    const img = container.querySelector('img');
    if(!img) return;

    // 이미 canvas로 교체된 경우
    if(container.querySelector('canvas')) return;

    container.dataset.wm = '1';

    const doRender = ()=>{
      const src = img.src || img.dataset.src;
      if(!src || src.startsWith('data:') && src.includes('wm')) return;

      getWatermarked(src, dataUrl=>{
        if(!dataUrl) return; // 실패 시 원본 유지
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
        canvas.width  = img.naturalWidth  || 300;
        canvas.height = img.naturalHeight || 420;
        const ctx = canvas.getContext('2d');

        // img → canvas
        const tmp = new Image();
        tmp.onload = ()=>{
          ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
          drawWatermark(ctx, canvas.width, canvas.height);
        };
        tmp.src = dataUrl;

        // 우클릭 차단
        canvas.addEventListener('contextmenu', e=>e.preventDefault());

        // img를 canvas로 교체
        img.replaceWith(canvas);
      });
    };

    if(img.complete && img.naturalWidth){ doRender(); }
    else { img.addEventListener('load', doRender, {once:true}); }
  }

  // MutationObserver로 동적 카드도 자동 처리
  const observer = new MutationObserver(muts=>{
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node.nodeType!==1) continue;
        // .pci, .fs-img-wrap 내부 처리
        const containers = node.classList&&(node.classList.contains('pci')||node.classList.contains('fs-img-wrap'))
          ? [node]
          : [...node.querySelectorAll('.pci, .fs-img-wrap')];
        containers.forEach(applyToContainer);
      }
    }
  });

  // 전역 API
  window.WM = {
    apply: applyToContainer,
    get: getWatermarked,
    cache: CACHE,
    // 페이지 전체 스캔 (renderCur 이후 호출용)
    scanAll: ()=>{ document.querySelectorAll('.pci, .fs-img-wrap').forEach(applyToContainer); }
  };

  // DOM 준비되면 옵저버 시작
  if(document.body){
    observer.observe(document.body, {childList:true, subtree:true});
  } else {
    document.addEventListener('DOMContentLoaded', ()=>{
      observer.observe(document.body, {childList:true, subtree:true});
    });
  }
})();
