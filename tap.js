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
   ・🔴 click も併せて購読する(2026-09-30・キットの tap.js と同じ直し): TalkBack などの読み上げ操作・スイッチ操作・
     音声操作・キーボードは pointer イベントを出さず click だけを出す。pointerup だけだと、どのボタンも押せなかった。
     直前 700ms 以内に pointerup で発火していたら、その click は同じ指のものなので捨てる(2回押しにしない)
   ========================================================= */
const Tap = (() => {
  const MOVE_LIMIT = 36;   // これ以上ずれたら「迷い/スクロール」とみなし発火しない
  /* 👻 あとから来るクリックを捨てる(2026-09-30・新アプリ8本のキットと同じ):
     pointerup で発火して画面が切り替わると、同じ指の あとから来る mousedown / mouseup / click が
     「新しい画面の同じ位置にある要素」に当たる(入力欄にフォーカスが入って キーボードが出る・選ぶ欄が開く など)。
     pointerup で発火したあと 700ms 以内・MOVE_LIMIT px 以内の mousedown / mouseup / click(本物の指のもの)を
     document で捨てる(click を捨てたら終わり)。pointer イベントは捨てないので、すぐ次のタップは今までどおり効く。
     アプリが呼ぶ el.click()(写真・ファイルを選ぶ窓を開く)は isTrusted=false なので捨てない
     🔴 mousedown を捨てるとフォーカスも動かない: 字を入れている欄で Tap のボタンを押しても欄が選ばれたまま=キーボードが閉じない。
     指が触れたときに選ばれていた欄が、まだ選ばれたままなら外す(捨てる前の mousedown と同じ)。押した処理が選んだ欄はそのまま */
  let ghost = null, downFocus = null;
  function isGhost(e){
    if(!ghost || !e.isTrusted) return false;
    if(Date.now() > ghost.until){ ghost = null; return false; }
    return Math.hypot((e.clientX || 0) - ghost.x, (e.clientY || 0) - ghost.y) <= MOVE_LIMIT;
  }
  if(typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('pointerdown', () => { downFocus = document.activeElement; }, true);
    ['mousedown', 'mouseup', 'click'].forEach(type => document.addEventListener(type, e => {
      if(!isGhost(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if(type === 'mousedown'){
        const a = document.activeElement;
        if(a && a === downFocus && a !== e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)){ try{ a.blur(); }catch(_){} }
      }
      if(type === 'click') ghost = null;
    }, true));
  }
  function bind(el, fn, opts){
    const o = opts || {};
    el.style.touchAction = o.game ? 'none' : 'manipulation';
    let sx = 0, sy = 0, pid = null, lastFire = 0;
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
        lastFire = Date.now();
        const g = ghost = { x:e.clientX, y:e.clientY, until:Date.now() + 700 };   // このあとの同じ指の mouse/click を捨てる(上の 👻)
        try{ fn(e); }
        finally{
          /* 同じ指の click は、処理(fn)が終わってから届く。処理が重くて 700ms を越えると(遅い端末で写真を作るときなど)、
             付けた時刻が切れて click が通り、2回押しになる・切り替わった先の同じ位置の Tap のボタンまで押される(9/30 深夜に確かめた)。
             処理のあとで時刻を付け直す */
          const now = Date.now();
          lastFire = now;
          if(ghost === g) g.until = now + 700;
        }
      }
    });
    el.addEventListener('pointercancel', ()=>{ pid = null; el.classList.remove('pressing'); });
    /* 読み上げ操作・スイッチ・音声操作・キーボード(Enter / スペース)は click だけが来る。
       指で押したときと同じく、手応え音 → 処理 の順にする。直前に pointerup で発火していたら何もしない。
       アプリが呼ぶ input.click()(写真・ファイルを選ぶ窓)は、どれも Tap のボタンの外にあるので ここには来ない。
       lastFire は pointerup で発火したときだけ付ける(click どうしは捨てない = Enter や スイッチを すばやく続けて押しても1回ずつ効く。🔒 の連打も) */
    el.addEventListener('click', e=>{
      if(Date.now() - lastFire < 700) return;   // 直前の pointerup で発火済み(同じ指の click)
      if(!o.silent) Sound.tap();
      fn(e);
    });
    el.addEventListener('contextmenu', e=> e.preventDefault());   // 長押しメニュー抑止
  }
  return { bind };
})();
