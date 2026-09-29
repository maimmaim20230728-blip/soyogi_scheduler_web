/* =========================================================
   Tap ― 長押しでも確実に反応するタップ判定（楽々スマホ対策）
   ・click は「短く押して動かさず離す」しか拾わないため、
     らくらくスマートフォン等で「グッと押し込む」操作をする方の
     タップが無反応になる（押し込みで指がわずかに動く/長押し扱い）
   ・pointerdown→pointerup の自前判定に置き換え:
     - 押した時間は無制限（長押しOK）
     - 指の移動が MOVE_LIMIT px 以内なら発火
     - pointerdown の瞬間に「沈む見た目(.pressing)」と手応え音
   ・使い方: Tap.bind(el, fn)              … スクロールと共存（メニュー等）
             Tap.bind(el, fn, {game:true}) … ゲーム面（スクロール無し）は
               touch-action:none でブラウザのパン判定を完全に止め、
               押し込み中のブレで pointercancel が来ないようにする
             {silent:true} … 押下音を鳴らさない
   ========================================================= */
const Tap = (() => {
  const MOVE_LIMIT = 36;   // これ以上ずれたら「迷い/スクロール」とみなし発火しない
  /* 👻 あとから来るクリックを捨てる(2026-09-30・新アプリ8本のキットと同じ):
     pointerup で発火して画面が切り替わると、同じ指の あとから来る mousedown / mouseup / click が
     「新しい画面の同じ位置にある要素」に当たる(入力欄にフォーカスが入って キーボードが出る・選ぶ欄が開く など)。
     pointerup で発火したあと 700ms 以内・MOVE_LIMIT px 以内の mousedown / mouseup / click(本物の指のもの)を
     document で捨てる(click を捨てたら終わり)。pointer イベントは捨てないので、すぐ次のタップは今までどおり効く。
     アプリが呼ぶ el.click()(写真・ファイルを選ぶ窓を開く)は isTrusted=false なので捨てない */
  let ghost = null;
  function isGhost(e){
    if(!ghost || !e.isTrusted) return false;
    if(Date.now() > ghost.until){ ghost = null; return false; }
    return Math.hypot((e.clientX || 0) - ghost.x, (e.clientY || 0) - ghost.y) <= MOVE_LIMIT;
  }
  if(typeof document !== 'undefined' && document.addEventListener){
    ['mousedown', 'mouseup', 'click'].forEach(type => document.addEventListener(type, e => {
      if(!isGhost(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if(type === 'click') ghost = null;
    }, true));
  }
  function bind(el, fn, opts){
    const o = opts || {};
    el.style.touchAction = o.game ? 'none' : 'manipulation';
    let sx = 0, sy = 0, pid = null;
    el.addEventListener('pointerdown', e=>{
      if(!e.isPrimary) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      el.classList.add('pressing');
      // 🔴 setPointerCapture は使わない: iOS Safari ではタッチpointerを捕捉すると
      //    その後の pointerup がこの要素に届かなくなり（pointercancel化）、
      //    「音は鳴るのに画面が遷移しない」不具合になる（Androidらくらくでは正常）。
      if(!o.silent) Sound.tap();          // 押した瞬間の手応え音
    });
    el.addEventListener('pointerup', e=>{
      if(e.pointerId !== pid) return;
      pid = null;
      el.classList.remove('pressing');
      if(Math.hypot(e.clientX - sx, e.clientY - sy) <= MOVE_LIMIT){
        ghost = { x:e.clientX, y:e.clientY, until:Date.now() + 700 };   // このあとの同じ指の mouse/click を捨てる(上の 👻)
        fn(e);
      }
    });
    el.addEventListener('pointercancel', ()=>{ pid = null; el.classList.remove('pressing'); });
    el.addEventListener('contextmenu', e=> e.preventDefault());   // 長押しメニュー抑止
  }
  return { bind };
})();
