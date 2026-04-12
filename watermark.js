/* ══════════════════════════════════
   WATERMARK.JS — CaligoPt2
   트래픽 최소화: 이미지 1회 로드, 중복 처리 완전 차단
══════════════════════════════════ */
(function(){
  const CACHE = new Map(); // src → dataURL (워터마크 합성 완료)
  const MAX_CACHE = 300;
  const WM_TEXT = 'CaligoPt2 PLAVE';
  const WM_OPACITY = 0.13;
  const WM_FONT_SIZE = 12;
  const WM_SPACING_X = 55;
  const WM_SPACING_Y = 30;
  const WM_ANGLE = -22;

  function evict(){
    if(CACHE.size >= MAX_CACHE) CACHE.delete(CACHE.keys().next().value);
  }

  function drawWM(ctx, w, h){
    ctx.save();
    ctx.globalAlpha = WM_OPACITY;
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${WM_FONT_SIZE}px Outfit,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rad = WM_ANGLE * Math.PI / 180;
    const diag = Math.sqrt(w*w + h*h);
    const cols = Math.ceil(diag / WM_SPACING_X) + 2;
    const rows = Math.ceil(diag / WM_SPACING_Y) + 2;
    ctx.translate(w/2, h/2);
    ctx.rotate(rad);
    for(let r = -rows; r <= rows; r++)
      for(let c = -cols; c <= cols; c++)
        ctx.fillText(WM_TEXT, c*WM_SPACING_X + (r%2===0?0:WM_SPACING_X/2), r*WM_SPACING_Y);
    ctx.restore();
  }

  // img 엘리먼트를 canvas로 교체 (이미지 추가 요청 없음)
  // img가 이미 로드된 상태의 픽셀 데이터를 그대로 사용
  function applyImg(imgEl){
    if(!imgEl || imgEl.dataset.wm === '1') return;
    imgEl.dataset.wm = '1';

    const render = () => {
      const src = imgEl.src;
      if(!src || src.startsWith('blob:')) return;

      // 캐시에 있으면 바로 사용 (네트워크 요청 없음)
      if(CACHE.has(src)){
        _replaceWithCanvas(imgEl, CACHE.get(src));
        return;
      }

      // img가 이미 로드돼 있으면 픽셀 직접 사용 (추가 요청 없음)
      if(imgEl.complete && imgEl.naturalWidth){
        _renderFromImg(imgEl, src);
      }
      // 아직 로딩 중이면 load 이벤트 대기 (이미 진행 중인 요청 활용)
      else {
        imgEl.addEventListener('load', () => _renderFromImg(imgEl, src), {once: true});
      }
    };

    render();
  }

  function _renderFromImg(imgEl, src){
    try{
      const w = imgEl.naturalWidth || 300;
      const h = imgEl.naturalHeight || 420;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      drawWM(ctx, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', 0.88);
      evict();
      CACHE.set(src, dataUrl);
      _replaceWithCanvas(imgEl, dataUrl);
    } catch(e){
      // tainted (cross-origin) — 원본 유지, 워터마크 없이
      // 추가 네트워크 요청 하지 않음
      imgEl.dataset.wm = 'skip';
    }
  }

  function _replaceWithCanvas(imgEl, dataUrl){
    if(!imgEl.parentNode) return;
    const cv = document.createElement('canvas');
    // 원본 img 스타일 그대로 복사
    cv.style.cssText = imgEl.style.cssText || 'width:100%;height:100%;object-fit:cover;display:block';
    if(imgEl.className) cv.className = imgEl.className;
    // dataUrl → canvas에 그리기
    cv.width = imgEl.naturalWidth || 300;
    cv.height = imgEl.naturalHeight || 420;
    const ctx = cv.getContext('2d');
    const tmp = new Image();
    tmp.onload = () => ctx.drawImage(tmp, 0, 0, cv.width, cv.height);
    tmp.src = dataUrl;
    // 우클릭 저장 차단
    cv.addEventListener('contextmenu', e => e.preventDefault());
    imgEl.replaceWith(cv);
  }

  // 컨테이너(.pci, .fs-img-wrap) 처리
  function applyToContainer(container){
    if(!container || container.dataset.wm === '1') return;
    container.dataset.wm = '1';
    const img = container.querySelector('img');
    if(img) applyImg(img);
  }

  // 전체 스캔 (renderCur 후)
  function scanAll(){
    document.querySelectorAll('.pci:not([data-wm]), .fs-img-wrap:not([data-wm])').forEach(applyToContainer);
    const fsImg = document.getElementById('fs-img');
    if(fsImg && fsImg.dataset.wm !== '1'){
      const img = fsImg.querySelector('img');
      if(img) applyImg(img);
    }
  }

  // MutationObserver: 새로 추가된 카드만 처리
  const observer = new MutationObserver(muts => {
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node.nodeType !== 1) continue;
        if(node.classList?.contains('pci') || node.classList?.contains('fs-img-wrap')){
          applyToContainer(node);
        } else {
          node.querySelectorAll?.('.pci:not([data-wm]), .fs-img-wrap:not([data-wm])').forEach(applyToContainer);
        }
        // fs-img 내부
        if(node.id === 'fs-img' || node.closest?.('#fs-img')){
          const img = node.tagName==='IMG' ? node : node.querySelector('img');
          if(img && img.dataset.wm !== '1') applyImg(img);
        }
      }
    }
  });

  if(document.body){
    observer.observe(document.body, {childList: true, subtree: true});
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {childList: true, subtree: true});
    });
  }

  window.WM = { apply: applyToContainer, applyImg, scanAll, cache: CACHE };
})();
