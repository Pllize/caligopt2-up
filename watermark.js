/* ══════════════════════════════════
   WATERMARK.JS — CaligoPt2
   Canvas 실시간 워터마크 합성 + LRU 캐시
══════════════════════════════════ */
(function(){
  const CACHE = new Map();
  const MAX_CACHE = 200;
  const WM_TEXT = 'CaligoPt2';
  const WM_OPACITY = 0.13;   // 불투명도 (낮을수록 흐림)
  const WM_FONT_SIZE = 9;    // px
  const WM_SPACING_X = 52;
  const WM_SPACING_Y = 28;
  const WM_ANGLE = -22;      // 기울기(도)

  function evictCache(){
    if(CACHE.size >= MAX_CACHE){
      const first = CACHE.keys().next().value;
      CACHE.delete(first);
    }
  }

  function applyWatermark(img, callback){
    const key = img.src;
    if(CACHE.has(key)){ callback(CACHE.get(key)); return; }

    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth  || img.width  || 300;
    canvas.height = img.naturalHeight || img.height || 420;
    const ctx = canvas.getContext('2d');

    // 원본 이미지 그리기
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 워터마크 레이어
    ctx.save();
    ctx.globalAlpha = WM_OPACITY;
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${WM_FONT_SIZE}px "Outfit", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const rad = WM_ANGLE * Math.PI / 180;
    const w = canvas.width, h = canvas.height;
    const diag = Math.sqrt(w * w + h * h);
    const cols = Math.ceil(diag / WM_SPACING_X) + 2;
    const rows = Math.ceil(diag / WM_SPACING_Y) + 2;

    ctx.translate(w / 2, h / 2);
    ctx.rotate(rad);

    for(let r = -rows; r <= rows; r++){
      for(let c = -cols; c <= cols; c++){
        const x = c * WM_SPACING_X + (r % 2 === 0 ? 0 : WM_SPACING_X / 2);
        const y = r * WM_SPACING_Y;
        ctx.fillText(WM_TEXT, x, y);
      }
    }
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    evictCache();
    CACHE.set(key, dataUrl);
    callback(dataUrl);
  }

  // <img> 엘리먼트에 워터마크 적용
  function applyToImgEl(imgEl){
    if(!imgEl || !imgEl.src || imgEl.dataset.wm === '1') return;
    imgEl.dataset.wm = '1';

    const doApply = () => {
      if(!imgEl.naturalWidth) return; // 아직 안 로딩됨
      applyWatermark(imgEl, dataUrl => {
        imgEl.src = dataUrl;
      });
    };

    if(imgEl.complete && imgEl.naturalWidth){
      doApply();
    } else {
      imgEl.addEventListener('load', doApply, { once: true });
    }
  }

  // 캔버스에 바로 합성 후 dataUrl 반환 (스크린샷용)
  function getWatermarked(src, callback){
    if(CACHE.has(src)){ callback(CACHE.get(src)); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => applyWatermark(img, callback);
    img.onerror = () => callback(src); // 실패 시 원본
    img.src = src;
  }

  // MutationObserver로 동적으로 추가되는 카드 이미지도 자동 처리
  const observer = new MutationObserver(muts => {
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node.nodeType !== 1) continue;
        const imgs = node.tagName === 'IMG' ? [node] : [...node.querySelectorAll('img[data-wm!="1"]')];
        imgs.forEach(img => {
          // 카드 이미지만 처리 (풀스크린 포함)
          if(img.closest('.pci,.fs-img-wrap,.crd-img')) applyToImgEl(img);
        });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // 전역 노출
  window.WM = { apply: applyToImgEl, get: getWatermarked, cache: CACHE };
})();
