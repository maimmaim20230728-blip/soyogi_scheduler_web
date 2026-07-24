'use strict';
/* ビジュアルタイマー(そよぎ式スケジューラー)
   ・そのカード(活動)に割り当てた時間を「満タン」として、残り時間ぶんの扇形が減っていく面積表示
     = WSサポート障害者版の tmDrawDial(まんたん方式)を流用
   ・🔴 Time Timer の赤い円盤は意匠特許(dontCopy)。そよぎ色の緑の扇形にして模倣を避ける
   ・残り時間は Date.now() 基準で再計算(setInterval 200ms・端末のスロットリングに強い)
   ・0になったら onEnd() を呼ぶ(合図音・明滅は呼び出し側=app.jsで)
   ・表示は disc(えんグラフ) / digital(すうじ) の2方式(せっていで切替)
   使い方: Timer.mount(canvasEl, digitalEl) → setTotal(秒) → start()/stop()/reset() */
const Timer = (() => {
  let canvas = null, digital = null, ctx = null;
  let total = 0, endAt = 0, remain = 0, running = false, iv = 0;
  let style = 'disc';       // 'disc' | 'digital'
  let endCb = null;
  const SECTOR = '#34b27b';  // 残り時間の扇形(そよぎ緑・Time Timerの赤を避ける)
  const HUB = '#2e9e6b';

  function mount(cv, dg){
    canvas = cv || null; digital = dg || null;
    ctx = (canvas && canvas.getContext) ? canvas.getContext('2d') : null;
  }
  function setStyle(s){ style = (s === 'digital') ? 'digital' : 'disc'; paint(); }

  function fmt(sec){
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function drawDial(){
    if(!ctx || !canvas) return;
    const W = canvas.width, cx = W / 2, cy = W / 2, R = W / 2 - 14;
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = '#dbe7e0'; ctx.stroke();
    let frac = total > 0 ? remain / total : 0;
    frac = Math.max(0, Math.min(1, frac));
    if(frac > 0){
      ctx.beginPath(); ctx.moveTo(cx, cy);
      // 上(-90度)から反時計回りに frac ぶんの扇形 = 残り時間の面積
      ctx.arc(cx, cy, R - 8, -Math.PI / 2, -Math.PI / 2 - frac * Math.PI * 2, true);
      ctx.closePath(); ctx.fillStyle = SECTOR; ctx.fill();
    }
    // 目盛12本(1周=そのカードの持ち時間)
    for(let i = 0; i < 12; i++){
      const a = -Math.PI / 2 + i * Math.PI * 2 / 12, r1 = R - 22, r2 = R - 4;
      ctx.beginPath();
      ctx.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
      ctx.lineWidth = 4; ctx.strokeStyle = '#b8ccc3'; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fillStyle = HUB; ctx.fill();
  }

  function paint(){
    if(digital) digital.textContent = fmt(remain);
    if(canvas && canvas.style){
      canvas.style.display = (style === 'digital') ? 'none' : '';
      if(style !== 'digital') drawDial();
    }
  }

  function tick(){
    remain = (endAt - Date.now()) / 1000;
    if(remain <= 0){
      remain = 0; stop(); paint();
      if(endCb) endCb();
      return;
    }
    paint();
  }

  function setTotal(sec){ total = Math.max(0, sec | 0); remain = total; paint(); }
  function start(){
    if(total <= 0) return;
    endAt = Date.now() + remain * 1000;
    running = true; clearInterval(iv); iv = setInterval(tick, 200); paint();
  }
  function stop(){ running = false; clearInterval(iv); iv = 0; }
  function reset(){ stop(); remain = total; paint(); }

  return {
    mount, setStyle, setTotal, start, stop, reset,
    paint,
    onEnd(cb){ endCb = cb; },
    get running(){ return running; },
    get remain(){ return remain; },
    get total(){ return total; }
  };
})();
