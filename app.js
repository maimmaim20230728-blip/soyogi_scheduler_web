'use strict';
/* そよぎ式スケジューラー 本体(v0.1・骨格)
   ・端末内だけに保存(localStorage)・完全オフライン・匿名・広告なし
   ・中核: 絵カードを順に並べ、「いま」1件を大きく見せ、タップで「おわった」へ。あと◯こを可視化(TEACCH)
   ・click禁止: 操作は全て Tap.bind(tap.js)。select/file input だけはネイティブイベント
   ・成人の尊厳を保つ(大げさな褒め演出・得点化はしない)。完了は静かな音+チェックのみ
   ・カード語彙・テンプレは cards.js(ヒロさん監修前のたたき台)。仕様は SPEC_V1.md / DESIGN.md */
(function(){

const VER = '0.1.5';
const LS_PLAN   = 'sched.plan.v1';    // { items:[{ref,min,done}], updated }
const LS_CUSTOM = 'sched.cards.v1';   // [{ id:'u1', emoji, text }]
const LS_LABELS = 'sched.labels.v1';  // { 組み込みカードid: 上書きした言葉 }(各家庭で表現が違う対応)
const LS_PREF   = 'sched.pref.v1';

const LANGS  = ['ja','en','de','fr','es','it','pt','nl','sv','ko','zh','ar'];
const RTL_LANGS = ['ar'];
const THEMES = ['green','aqua','white','dark'];
const BGMS   = ['off','green','blue'];
const TIMER_STYLES = ['disc','digital'];
const MIN_OPTIONS  = [0,1,3,5,10,15,30,60];  // カードの持ち時間(分)。0=なし

const CAT = window.SCHED_CARDS;               // { CATEGORIES, CARDS, TEMPLATES }

const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if(cls) e.className = cls;
  if(txt != null) e.textContent = txt;
  return e;
};

function loadJSON(key){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
  catch(_){ return null; }
}
function saveJSON(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(_){ return false; }
}
function vibrate(ms){ try{ if(typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); }catch(_){} }

/* ---- 設定(ホワイトリスト経由) ---- */
function sanitizePref(p){
  p = p || {};
  return {
    lang:  LANGS.indexOf(p.lang)   >= 0 ? p.lang  : 'ja',
    fs:    [0,1,2].indexOf(p.fs)   >= 0 ? p.fs    : 0,
    sound: (p.sound === undefined) ? true : !!p.sound,
    theme: THEMES.indexOf(p.theme) >= 0 ? p.theme : 'green',
    bgm:   BGMS.indexOf(p.bgm)     >= 0 ? p.bgm   : 'green',   // 既定=音1(みどり・控えめ音量)で初期ON(2026-07-25ヒロ要望)
    timerStyle: TIMER_STYLES.indexOf(p.timerStyle) >= 0 ? p.timerStyle : 'disc',
    vol:   [0,1,2].indexOf(p.vol)  >= 0 ? p.vol   : 1,
    tapUnlock: (p.tapUnlock >= 3 && p.tapUnlock <= 10) ? (p.tapUnlock | 0) : 5,   // 介護者モードに入る連打回数(3〜10)
    cardSize: [0,1,2].indexOf(p.cardSize) >= 0 ? p.cardSize : 1,                  // カードの大きさ 中/大/特大(既定=大)
    fadeSec:  (p.fadeSec  >= 0 && p.fadeSec  <= 5) ? (p.fadeSec  | 0) : 2,         // 消える(フェードアウト)秒数(0〜5・既定2)
    slideSec: (p.slideSec >= 0 && p.slideSec <= 5) ? (p.slideSec | 0) : 1,         // 消えたあと つぎが上がる秒数(0〜5・既定1)
    showText: (p.showText === undefined) ? true : !!p.showText,                    // カードに文字を出すか(字が読めない人向けにOFF可・既定ON)
    showCount: (p.showCount === undefined) ? true : !!p.showCount                  // 「あと なんこ」バッジを出すか(不安な人向けにOFF可・既定ON)
  };
}
let pref = sanitizePref(loadJSON(LS_PREF));
function savePref(){ saveJSON(LS_PREF, pref); }
function next(list, cur){ return list[(list.indexOf(cur) + 1) % list.length]; }

/* ---- i18n ---- */
function walk(obj, key){
  return key.split('.').reduce((a, c) => (a && a[c] !== undefined) ? a[c] : undefined, obj);
}
function T(key){
  const tbl = window.SCHED_I18N;
  const v = walk(tbl[pref.lang] || tbl.ja, key);
  return (v === undefined) ? walk(tbl.ja, key) : v;
}

/* 静的要素id → i18nキー(疑似DOMスモークで機械検証できるよう明示マップ方式) */
const I18N_MAP = {
  'hd-title':'app.name',
  'today-title':'today.title', 'btn-reset':'today.reset', 'btn-focus':'today.focus',
  'make-hint':'make.hint', 'make-palette-head':'make.palette',
  'make-custom-head':'make.addCustom', 'custom-hint':'make.customHint',
  'btn-custom-add':'make.addEmoji', 'btn-photo':'make.photo',
  'make-plan-head':'make.planTitle', 'btn-clear':'make.clear',
  'lock-note':'lock.setNote', 'btn-lock':'lock.toSelf', 'btn-lock-make':'lock.toSelf', 'lbl-tapn':'lock.tapN',
  'set-h-normal':'set.hNormal', 'lbl-fs':'set.fs', 'lbl-cardsize':'set.cardSize', 'lbl-showtext':'set.showText', 'lbl-showcount':'set.showCount', 'lbl-theme':'set.theme',
  'lbl-bgm':'set.bgm', 'lbl-sound':'set.sound', 'lbl-fade':'set.fade', 'lbl-slide':'set.slide',
  'set-h-show':'set.hShow', 'lbl-timer':'set.timerStyle', 'lbl-vol':'set.vol',
  'set-h-backup':'set.hBackup', 'bk-hint':'set.bkHint', 'bk-export':'set.bkExport', 'bk-import':'set.bkImport',
  'link-privacy':'set.privacy', 'about-credit':'set.credit',
  'focus-close':'focus.close', 'focus-next-label':'focus.next',
  'crop-title':'make.cropTitle', 'crop-hint':'make.cropHint', 'crop-cancel':'make.cropCancel', 'crop-ok':'make.cropOk',
  'tab-today':'tab.today', 'tab-make':'tab.make', 'tab-set':'tab.set'
};

/* ---- カタログ解決(組み込みカード or 自作カード) ---- */
let customStore = loadJSON(LS_CUSTOM);
if(!Array.isArray(customStore)) customStore = [];
function saveCustom(){ return saveJSON(LS_CUSTOM, customStore); }
let labelStore = loadJSON(LS_LABELS);
if(!labelStore || typeof labelStore !== 'object') labelStore = {};
function saveLabels(){ saveJSON(LS_LABELS, labelStore); }
function findBuiltin(id){ for(const c of CAT.CARDS) if(c.id === id) return c; return null; }
function findCustom(id){ for(const c of customStore) if(c.id === id) return c; return null; }
function resolveCard(ref){
  const b = findBuiltin(ref);
  if(b) return { id:b.id, emoji:b.emoji, label:(labelStore[ref] != null ? labelStore[ref] : T('card.' + b.id)) };
  const c = findCustom(ref);
  if(c) return { id:c.id, emoji:c.emoji, label:c.text, img:c.img, custom:true };
  return { id:ref, emoji:'❓', label:String(ref) };
}
/* カードの言葉を上書き(自由記入)。組み込み=labelStore、自作=customStore.text。空にすると組み込みは既定へ戻る */
function setCardLabel(ref, value){
  value = (value || '').trim();
  if(findBuiltin(ref)){
    if(value) labelStore[ref] = value; else delete labelStore[ref];
    saveLabels();
  } else {
    const c = findCustom(ref);
    if(c){ c.text = value; saveCustom(); }
  }
}
/* カードの顔: 写真カードは img、絵カードは絵文字spanを返す(表示箇所で共通利用) */
function createFace(cls, c){
  if(c.img){
    const im = document.createElement('img');
    im.className = cls + ' isimg'; im.src = c.img; im.alt = '';
    return im;
  }
  return el('span', cls, c.emoji);
}

/* ---- 予定(プラン) ---- */
function seedPlan(){
  // 初回だけ「あさのしたく」を入れておく(空っぽで戸惑わせない=調査反映)
  const t = CAT.TEMPLATES.find(x => x.id === 'morning');
  const cards = t ? t.cards : [];
  return { items: cards.map(ref => ({ ref, min:0, done:false })), updated: 0 };
}
let plan = loadJSON(LS_PLAN);
if(!plan || !Array.isArray(plan.items)) plan = seedPlan();
function savePlan(){ plan.updated = Date.now(); saveJSON(LS_PLAN, plan); }
function currentIndex(){ return plan.items.findIndex(it => !it.done); }
function remainingCount(){ return plan.items.filter(it => !it.done).length; }

/* ---- 画面切替 ---- */
const SCREENS = { 'scr-today':'tab-today', 'scr-make':'tab-make', 'scr-set':'tab-set' };
function showScreen(id){
  if(id !== 'scr-today') ptStop();   // よてい以外へ移ったらカードタイマーは止める
  for(const s in SCREENS){
    $(s).classList.toggle('hidden', s !== id);
    $(SCREENS[s]).classList.toggle('active', s === id);
  }
  if(id === 'scr-today') renderToday();
  if(id === 'scr-make'){ renderCats(); renderPalette(); renderPlanList(); }
}

/* ---- 介護者ロック(モード分離) ----
   既定=本人モード(施錠)。つくる/せってい を隠し、本人画面には編集UIを出さない(調査反映)。
   ヘッダーの🔒を長押し(1.5秒)で介護者モードへ。せっていの「ほんにんモードに もどす」で再施錠。
   起動のたびに施錠から始める(本人が編集画面に迷い込まない) */
let locked = true;
function applyLock(){
  $('tab-make').classList.toggle('hidden', locked);
  $('tab-set').classList.toggle('hidden', locked);
  $('hd-lock').textContent = locked ? '🔒' : '🔓';
  const hh = $('hd-lock-hint'); if(hh) hh.classList.toggle('hidden', !locked);   // 施錠中だけ案内を出す(初見で積まない)
}
function unlock(){ if(!locked) return; locked = false; applyLock(); Sound.ding('done'); toast(T('lock.unlocked')); }
function lock(){ locked = true; showScreen('scr-today'); applyLock(); toast(T('lock.locked')); }
/* 🔒の連打で解錠(回数=pref.tapUnlock・3〜10)。連打の間隔が TAP_WINDOW を超えたら数え直し。
   解錠中の1タップで再施錠。長押しは使わない(ヒロ指定=連打方式) */
let tapCount = 0, lastTap = 0;
const TAP_WINDOW = 1200;
function onLockTap(){
  // 解錠中はヘッダーのタップでは施錠しない(連打で入った直後に誤って押しても本人モードに戻らないように)。
  // 本人モードに戻すのは せっていの「ほんにんモードに もどす」ボタンだけ。
  if(!locked) return;
  const now = Date.now();
  if(now - lastTap > TAP_WINDOW) tapCount = 0;
  lastTap = now; tapCount++;
  if(tapCount >= pref.tapUnlock){ tapCount = 0; unlock(); }
  else { toast(T('lock.hint').replace('{n}', String(pref.tapUnlock - tapCount))); }
}
function cycleTapN(){
  pref.tapUnlock = pref.tapUnlock >= 10 ? 3 : pref.tapUnlock + 1;
  savePref(); applyI18n();
}

/* ---- よてい(実行ビュー) ---- */
function renderToday(){
  const list = $('today-list'); list.textContent = '';
  const badge = $('today-remain');
  if(!plan.items.length){
    badge.classList.add('hidden');
    list.appendChild(el('div', 'today-empty', T('today.empty')));
    return;
  }
  // 残りのカードを「全部」順に表示(スクロール)。強調も淡色も「おわった」列も作らない。
  // タップで完了 → そのカードは消える(TEACCHのスケジュール・ストリップ方式)。
  const remaining = plan.items.map((x, i) => ({ x, i })).filter(o => !o.x.done);
  if(!remaining.length){
    badge.classList.add('hidden');
    list.appendChild(el('div', 'today-alldone', '✓ ' + T('today.allDone')));
    return;
  }
  if(pref.showCount){
    badge.classList.remove('hidden');
    badge.textContent = T('today.remain').replace('{n}', String(remaining.length));
  } else {
    badge.classList.add('hidden');   // 「あと なんこ」を隠す設定(不安な人向け)
  }
  // 大きな絵カードを縦に全部ならべる(スクロール)。大きさは せってい(cardSize)で変えられる。
  remaining.forEach((o, idx) => {
    const c = resolveCard(o.x.ref);
    const card = el('div', 'sched-card' + (idx === 0 ? ' sc-now' : ''));   // 一番上=白、これから=薄いグレー
    card.setAttribute('data-idx', String(o.i));
    const main = el('div', 'sc-main');                                     // 中身(絵+文字)は左そろえ
    main.appendChild(createFace('sc-emoji', c));
    if(pref.showText && c.label) main.appendChild(el('div', 'sc-text', c.label));   // 文字なし設定/空ラベルなら絵だけ
    card.appendChild(main);
    if(o.x.min > 0){
      const timer = el('div', 'sc-timer');                                // タイマーは右側・大きめ
      const inner = el('div', 'sct-inner');
      inner.appendChild(el('span', 'sct-n', String(o.x.min)));
      timer.appendChild(inner);
      timer.style.background = 'conic-gradient(#34b27b 360deg, #dfeae4 0deg)';   // 満タン(まだ動いていない)
      Tap.bind(timer, e => ptToggle(o.i, timer, e), { silent:true });            // タイマー(円)タップ=開始/停止
      card.appendChild(timer);
    }
    Tap.bind(card, () => markDone(o.i), { silent:true });   // カード本体タップ=完了→消える
    list.appendChild(card);
  });
  ptResume();
}

/* ---- カードのタイマー(各カードの中に表示・タップで開始/停止・同時に動くのは1つ) ----
   ・満タンから緑の扇形が減る(timer.js と同じ考え方)。0で やさしい合図音+明滅
   ・カード本体タップ=完了、タイマー(円)タップ=開始/停止(stopPropagationで区別) */
let ptActive = -1, ptEnd = 0, ptIv = 0;
function ptRing(i){ return document.querySelector('.sched-card[data-idx="' + i + '"] .sc-timer'); }
function ptPaint(ring, i, remain){
  const total = (plan.items[i] ? plan.items[i].min : 0) * 60;
  const frac = total > 0 ? Math.max(0, Math.min(1, remain / total)) : 0;
  const deg = frac * 360;
  ring.style.background = 'conic-gradient(#34b27b ' + deg + 'deg, #dfeae4 ' + deg + 'deg)';
  const n = ring.querySelector('.sct-n');
  if(n) n.textContent = String(Math.max(0, Math.ceil(remain / 60)));
}
function ptStop(){ if(ptIv){ clearInterval(ptIv); ptIv = 0; } ptActive = -1; }
function ptTick(){
  const ring = ptRing(ptActive);
  if(!ring){ ptStop(); return; }
  const remain = (ptEnd - Date.now()) / 1000;
  if(remain <= 0){ ptPaint(ring, ptActive, 0); ring.classList.add('sct-alarm'); Sound.ding('timeup'); ptStop(); return; }
  ptPaint(ring, ptActive, remain);
}
function ptToggle(i, ring, e){
  if(e && e.stopPropagation) e.stopPropagation();
  const it = plan.items[i];
  if(!it || !(it.min > 0)) return;
  ring.classList.remove('sct-alarm');
  if(ptActive === i && ptIv){ ptStop(); ptPaint(ring, i, it.min * 60); return; }   // 動作中→止めて満タンに戻す
  ptStop();
  ptActive = i; ptEnd = Date.now() + it.min * 60 * 1000;
  ptIv = setInterval(ptTick, 250);
  ptTick();
}
function ptResume(){ if(ptActive >= 0 && ptIv){ if(ptRing(ptActive)) ptTick(); else ptStop(); } }
function fadeMs(){ return pref.fadeSec * 1000; }
function slideMs(){ return pref.slideSec * 1000; }
/* カードを消すアニメ: (1)fadeSec秒かけてフェードアウト → (2)slideSec秒かけて高さを潰し、下のカードが上に上がる */
function animateOut(card, done){
  const fs = fadeMs(), ss = slideMs();
  card.style.pointerEvents = 'none';
  card.style.transition = 'opacity ' + fs + 'ms linear';
  void card.offsetWidth;                 // reflowを挟んでtransitionを効かせる
  card.style.opacity = '0';
  setTimeout(function(){
    const h = card.offsetHeight;
    card.style.overflow = 'hidden';
    card.style.height = h + 'px';
    void card.offsetWidth;
    card.style.transition = 'height ' + ss + 'ms ease, margin ' + ss + 'ms ease, padding ' + ss + 'ms ease, border-width ' + ss + 'ms ease';
    card.style.height = '0px';
    card.style.marginBottom = '0px';
    card.style.paddingTop = '0px'; card.style.paddingBottom = '0px';
    card.style.borderTopWidth = '0px'; card.style.borderBottomWidth = '0px';
    setTimeout(done, ss);
  }, fs);
}
function markDone(i){
  const it = plan.items[i];
  if(!it || it.done) return;
  Sound.ding('done'); vibrate(30);
  if(i === ptActive) ptStop();
  it.done = true; savePlan();
  const card = document.querySelector('.sched-card[data-idx="' + i + '"]');
  if(!card || (fadeMs() + slideMs()) === 0){ renderToday(); return; }   // アニメ0秒 or 要素なし(疑似DOM)は即再描画
  animateOut(card, renderToday);
}
function undo(i){
  if(!plan.items[i]) return;
  plan.items[i].done = false; savePlan();
  renderToday();
}
function resetPlan(){
  plan.items.forEach(it => it.done = false); savePlan();
  renderToday();
}

/* ---- しゅうちゅう(1まいずつ・全画面・タイマー) ---- */
let focusI = -1, focusing = false, wakeLock = null;

function acquireWake(){
  try{
    if(navigator.wakeLock && navigator.wakeLock.request){
      navigator.wakeLock.request('screen').then(l => {
        wakeLock = l;
        if(!focusing){ try{ l.release(); }catch(_){} wakeLock = null; }
      }).catch(() => { wakeLock = null; });
    }
  }catch(_){ wakeLock = null; }
}
function releaseWake(){ try{ if(wakeLock) wakeLock.release(); }catch(_){} wakeLock = null; }

function buildFocus(){
  const body = $('focus-body'), doneBtn = $('btn-focus-done'), allEl = $('focus-alldone'), tw = $('focus-timer-wrap');
  tw.classList.remove('alarm');
  const ci = focusI;
  if(ci === -1 || ci >= plan.items.length || !plan.items.length){
    body.classList.add('hidden'); doneBtn.classList.add('hidden');
    allEl.classList.remove('hidden'); allEl.textContent = '✓ ' + T('focus.allDone');
    Timer.stop();
    return;
  }
  body.classList.remove('hidden'); doneBtn.classList.remove('hidden'); allEl.classList.add('hidden');
  const it = plan.items[ci], c = resolveCard(it.ref);
  const fe = $('focus-emoji'); fe.textContent = '';
  if(c.img){ const im = document.createElement('img'); im.className = 'focus-face isimg'; im.src = c.img; im.alt = ''; fe.appendChild(im); }
  else fe.textContent = c.emoji;
  $('focus-text').textContent  = pref.showText ? c.label : '';
  doneBtn.textContent = T('focus.done');

  if(it.min > 0){
    tw.classList.remove('hidden');
    Timer.setTotal(it.min * 60); Timer.start();
  } else {
    tw.classList.add('hidden'); Timer.stop();
  }

  const nx = plan.items.slice(ci + 1).find(x => !x.done);
  const nextRow = $('focus-next');
  if(nx){
    const rc = resolveCard(nx.ref);
    $('focus-next-label').textContent = T('focus.next');
    $('focus-next-card').textContent  = rc.emoji + ' ' + rc.label;
    nextRow.classList.remove('hidden');
  } else {
    nextRow.classList.add('hidden');
  }
}
function openFocus(){
  ptStop();
  focusing = true; focusI = currentIndex();
  $('scr-focus').classList.remove('hidden');
  buildFocus(); acquireWake();
  applyBarSpace();   // 「できた」が出てから実寸を測る(非表示のままだと高さ0で測れない)
}
function closeFocus(){
  focusing = false; Timer.stop();
  $('scr-focus').classList.add('hidden');
  $('focus-timer-wrap').classList.remove('alarm');
  releaseWake(); renderToday();
}
function focusDone(){
  if(focusI >= 0 && plan.items[focusI]){
    plan.items[focusI].done = true; savePlan();
    Sound.ding('done'); vibrate(30);
  }
  focusI = currentIndex();
  buildFocus();
}

/* ---- つくる(支援者が予定を組む) ---- */
let curCat = CAT.CATEGORIES[0].id;

function renderCats(){
  const cats = $('cats'); cats.textContent = '';
  CAT.CATEGORIES.forEach(cat => {
    const b = el('button', 'cat-tab' + (curCat === cat.id ? ' active' : ''), cat.emoji + ' ' + T('cat.' + cat.id));
    Tap.bind(b, () => { curCat = cat.id; renderCats(); renderPalette(); });
    cats.appendChild(b);
  });
  if(customStore.length){
    const b = el('button', 'cat-tab' + (curCat === '__mine' ? ' active' : ''), '⭐ ' + T('cat.mine'));
    Tap.bind(b, () => { curCat = '__mine'; renderCats(); renderPalette(); });
    cats.appendChild(b);
  }
}
function renderPalette(){
  const pal = $('palette'); pal.textContent = '';
  let cards;
  if(curCat === '__mine') cards = customStore.map(c => ({ id:c.id, emoji:c.emoji, label:c.text, img:c.img }));
  else cards = CAT.CARDS.filter(c => c.cat === curCat).map(c => ({ id:c.id, emoji:c.emoji, label:T('card.' + c.id) }));
  cards.forEach(c => {
    const b = el('button', 'pcard');
    b.appendChild(createFace('pe', c));
    b.appendChild(el('span', 'pl', c.label));
    Tap.bind(b, () => addToPlan(c.id, c.label));
    pal.appendChild(b);
  });
}
function addToPlan(ref, label){
  plan.items.push({ ref, min:0, done:false }); savePlan();
  renderPlanList();
  toast('＋ ' + label);
}
function moveItem(i, dir){
  const j = i + dir;
  if(j < 0 || j >= plan.items.length) return;
  const t = plan.items[i]; plan.items[i] = plan.items[j]; plan.items[j] = t;
  savePlan(); renderPlanList();
}
function renderPlanList(){
  const pl = $('plan-list'); pl.textContent = '';
  if(!plan.items.length){ pl.appendChild(el('div', 'plan-empty', T('make.empty'))); return; }
  plan.items.forEach((it, i) => {
    const c = resolveCard(it.ref);
    const row = el('div', 'plan-row');
    row.appendChild(createFace('pe', c));
    const nameIn = document.createElement('input');   // カードの言葉を自由記入で変えられる
    nameIn.type = 'text'; nameIn.className = 'pl-edit'; nameIn.value = c.label;
    nameIn.placeholder = T('make.customText');
    nameIn.addEventListener('change', () => { setCardLabel(it.ref, nameIn.value); renderPalette(); renderPlanList(); });
    row.appendChild(nameIn);
    const ms = document.createElement('select'); ms.className = 'plan-min';
    MIN_OPTIONS.forEach(m => {
      const o = document.createElement('option');
      o.value = String(m);
      o.textContent = (m === 0) ? T('make.noMin') : (m + T('make.minUnit'));
      ms.appendChild(o);
    });
    ms.value = String(it.min || 0);
    ms.addEventListener('change', () => { it.min = parseInt(ms.value, 10) || 0; savePlan(); });
    row.appendChild(ms);
    const up = el('button', 'mv', '▲'); Tap.bind(up, () => moveItem(i, -1));
    const dn = el('button', 'mv', '▼'); Tap.bind(dn, () => moveItem(i, 1));
    const del = el('button', 'mv del', '✕'); Tap.bind(del, () => { plan.items.splice(i, 1); savePlan(); renderPlanList(); });
    row.appendChild(up); row.appendChild(dn); row.appendChild(del);
    pl.appendChild(row);
  });
}
function clearPlan(){
  plan.items = []; savePlan();
  renderPlanList();
  toast(T('make.cleared'));
}
function loadTemplate(id){
  const t = CAT.TEMPLATES.find(x => x.id === id);
  if(!t) return;
  plan.items = t.cards.map(ref => ({ ref, min:0, done:false }));
  savePlan(); renderPlanList();
  toast(T('tpl.' + id));
}
function nextCustomId(){
  let maxN = 0;
  customStore.forEach(c => { const n = parseInt(String(c.id).slice(1), 10); if(n > maxN) maxN = n; });
  return 'u' + (maxN + 1);
}
function pushCustom(card){
  // 写真カードは枚数制限なし(端末ストレージが許すかぎり)。保存できなければ容量不足として通知し追加を取り消す
  customStore.push(card);
  if(!saveCustom()){
    customStore.pop();
    toast(T('make.storageFull'));
    return;
  }
  $('custom-text').value = '';
  curCat = '__mine'; renderCats(); renderPalette();
  toast(T('make.customAdd') + ' ✓');
}
function addCustom(){
  const txt = ($('custom-text').value || '').trim();
  if(!txt) return;
  pushCustom({ id: nextCustomId(), emoji: $('custom-emoji').value || '⭐', text: txt });
}
/* カメラ/カメラロールから写真を取り込み、トリミング画面を開く(外部送信なし) */
function onPhotoFile(e){
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if(!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => openCrop(img, url);
  img.onerror = () => { try{ URL.revokeObjectURL(url); }catch(_){} toast(T('make.photoFail')); };
  img.src = url;
}

/* ---- しゃしんの トリミング ----
   ・正方形の枠に対して、指で位置合わせ(pan) + スライダーで大きさ(zoom)を調整
   ・「これで つくる」で枠の中身を 256px 正方形の JPEG に切り出してカード化(端末内のみ) */
const CROP_V = 300, CROP_OUT = 256;
let cropImg = null, cropUrl = null, cropCtx = null;
let cropZoom = 1, cropBase = 1, cropOx = 0, cropOy = 0, cropDrag = null;

function cropDrawnW(){ return (cropImg.width  || 1) * cropBase * cropZoom; }
function cropDrawnH(){ return (cropImg.height || 1) * cropBase * cropZoom; }
function clampCrop(){
  cropOx = Math.min(0, Math.max(CROP_V - cropDrawnW(), cropOx));
  cropOy = Math.min(0, Math.max(CROP_V - cropDrawnH(), cropOy));
}
function drawCrop(){
  if(!cropCtx || !cropImg) return;
  cropCtx.clearRect(0, 0, CROP_V, CROP_V);
  cropCtx.drawImage(cropImg, 0, 0, cropImg.width, cropImg.height, cropOx, cropOy, cropDrawnW(), cropDrawnH());
}
function openCrop(img, url){
  cropImg = img; cropUrl = url || null;
  const cv = $('crop-canvas'); cropCtx = (cv && cv.getContext) ? cv.getContext('2d') : null;
  cropBase = CROP_V / Math.max(1, Math.min(img.width || 1, img.height || 1));   // 短辺が枠を満たす(cover)
  cropZoom = 1;
  const range = $('crop-range'); if(range) range.value = '100';
  cropOx = (CROP_V - cropDrawnW()) / 2;
  cropOy = (CROP_V - cropDrawnH()) / 2;
  clampCrop(); drawCrop();
  $('scr-crop').classList.remove('hidden');
}
function closeCrop(){
  $('scr-crop').classList.add('hidden');
  if(cropUrl){ try{ URL.revokeObjectURL(cropUrl); }catch(_){} }
  cropImg = null; cropUrl = null; cropCtx = null; cropDrag = null;
}
function cropZoomTo(v){
  const nz = Math.max(1, Math.min(3, (v || 100) / 100));
  const ow = cropDrawnW(), oh = cropDrawnH();
  cropZoom = nz;
  // 枠の中心を保ったまま拡大縮小する(急に飛ばない)
  cropOx = CROP_V / 2 - (CROP_V / 2 - cropOx) * (cropDrawnW() / ow);
  cropOy = CROP_V / 2 - (CROP_V / 2 - cropOy) * (cropDrawnH() / oh);
  clampCrop(); drawCrop();
}
function cropConfirm(){
  try{
    const out = document.createElement('canvas'); out.width = CROP_OUT; out.height = CROP_OUT;
    const octx = out.getContext('2d');
    const s = CROP_OUT / CROP_V;
    octx.drawImage(cropImg, 0, 0, cropImg.width, cropImg.height,
      cropOx * s, cropOy * s, cropDrawnW() * s, cropDrawnH() * s);
    const data = out.toDataURL('image/jpeg', 0.85);
    const txt = ($('custom-text').value || '').trim() || T('make.photoLabel');
    closeCrop();
    pushCustom({ id: nextCustomId(), img: data, text: txt });
  }catch(_){ closeCrop(); toast(T('make.photoFail')); }
}
function bindCropDrag(){
  const cv = $('crop-canvas'); if(!cv) return;
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', e => { cropDrag = { x:e.clientX, y:e.clientY }; });
  cv.addEventListener('pointermove', e => {
    if(!cropDrag) return;
    let disp = CROP_V;
    if(cv.getBoundingClientRect){ const r = cv.getBoundingClientRect(); if(r && r.width) disp = r.width; }
    const s = CROP_V / disp;                                   // 表示px → 内部px
    cropOx += (e.clientX - cropDrag.x) * s;
    cropOy += (e.clientY - cropDrag.y) * s;
    cropDrag = { x:e.clientX, y:e.clientY };
    clampCrop(); drawCrop();
  });
  cv.addEventListener('pointerup',     () => { cropDrag = null; });
  cv.addEventListener('pointercancel', () => { cropDrag = null; });
}
function fillTplSelect(){
  const sel = $('tpl-select'); sel.textContent = '';
  const first = document.createElement('option'); first.value = ''; first.textContent = T('make.loadTpl'); sel.appendChild(first);
  CAT.TEMPLATES.forEach(t => {
    const o = document.createElement('option'); o.value = t.id; o.textContent = T('tpl.' + t.id); sel.appendChild(o);
  });
  sel.value = '';
}

/* ---- 見た目/音 ---- */
function applyTheme(){ document.body.setAttribute('data-theme', pref.theme); }
function applyBodyClass(){
  document.body.className = 'fs' + pref.fs + ' cs' + pref.cardSize;
  applyBarSpace();   // 文字を大きくするとタブも「できた」も高くなる → 余白を測り直す
}

/* ---- 下タブと「できた」ボタンの高さを実測して余白に反映 ----
   targetSdk36(Android15+)はエッジtoエッジ強制で、画面がナビゲーションバーの下まで
   描かれる。#tabbar と .focus-done は自分の padding/bottom に safe-area を持つので
   その分だけ実際の高さが増えるが、本文側の余白がCSSの固定値だと足りず、
   「1まいずつ みる」や「できた」が隠れてしまう。高さは文字サイズ・言語でも変わるため実測する。 */
function applyBarSpace(){
  const st = document.documentElement && document.documentElement.style;
  if(!st || !st.setProperty) return;
  const put = (el, name) => {
    if(!el || !el.getBoundingClientRect) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    if(h > 0) st.setProperty(name, h + 'px');
  };
  put(document.getElementById('tabbar'), '--tabbar-h');
  const done = document.getElementById('btn-focus-done');
  /* 非表示(display:none)だと高さ0で測れないので、その時は据え置く */
  if(done && !done.classList.contains('hidden')) put(done, '--focusdone-h');
}
/* 実寸が変わった瞬間に測り直す。フォント読み込み・画面回転・文字サイズ変更の
   どれで変わっても取りこぼさないよう、イベント頼みでなく箱そのものを見張る。 */
function watchBarSpace(){
  if(typeof ResizeObserver === 'undefined') return false;
  try{
    const ro = new ResizeObserver(applyBarSpace);
    const tb = document.getElementById('tabbar'); if(tb) ro.observe(tb);
    const fd = document.getElementById('btn-focus-done'); if(fd) ro.observe(fd);
    return true;
  }catch(_){ return false; }
}
function applySoundPrefs(){
  Sound.setEnabled(pref.sound);
  if(pref.bgm !== 'off') Sound.setBgmMode(pref.bgm);
  Sound.setBgmEnabled(pref.bgm !== 'off');
}

function applyI18n(){
  for(const id in I18N_MAP){ const e = $(id); if(e) e.textContent = T(I18N_MAP[id]); }
  document.documentElement.lang = pref.lang;
  document.documentElement.dir = (RTL_LANGS.indexOf(pref.lang) >= 0) ? 'rtl' : 'ltr';
  $('btn-fs').textContent    = T('set.fsSizes')[pref.fs];
  $('btn-cardsize').textContent = T('set.cardSizes')[pref.cardSize];
  $('btn-fade').textContent  = pref.fadeSec  + T('set.sec');
  $('btn-slide').textContent = pref.slideSec + T('set.sec');
  $('btn-showtext').textContent = pref.showText ? T('set.on') : T('set.off');
  $('btn-showcount').textContent = pref.showCount ? T('set.on') : T('set.off');
  $('btn-theme').textContent = T('set.themes')[THEMES.indexOf(pref.theme)];
  $('btn-bgm').textContent   = T('set.bgms')[BGMS.indexOf(pref.bgm)];
  $('btn-sound').textContent = pref.sound ? T('set.on') : T('set.off');
  $('btn-timer').textContent = T('set.timerStyles')[TIMER_STYLES.indexOf(pref.timerStyle)];
  $('btn-vol').textContent   = T('set.vols')[pref.vol];
  $('btn-tapn').textContent  = pref.tapUnlock + T('lock.times');
  $('about-ver').textContent = 'v' + VER;
  const ct = $('custom-text'); if(ct) ct.placeholder = T('make.customText');
  fillTplSelect();
  renderToday(); renderCats(); renderPalette(); renderPlanList();
  applyBarSpace();   // 言語でタブのラベル幅が変わる(折り返しで高さが増える)ため測り直す
}
function applyAll(){
  applyBodyClass();
  applyTheme();
  applySoundPrefs();
  Sound.setVol(pref.vol);
  Timer.setStyle(pref.timerStyle);
  $('set-lang').value = pref.lang;
  applyI18n();
  applyBarSpace();
  watchBarSpace();
  /* ResizeObserver が無い環境(古いWebView)向けの保険 */
  if(typeof window !== 'undefined' && window.addEventListener){
    window.addEventListener('load', applyBarSpace);
    window.addEventListener('resize', applyBarSpace);
    window.addEventListener('orientationchange', applyBarSpace);
  }
}

/* ---- 機種変更(バックアップ)・おうち介護記録の方式流用 ---- */
function exportBackup(){
  const data = { app:'soyogi_scheduler', ver:1, plan, cards: customStore, labels: labelStore, prefs: pref };
  const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = 'soyogi-scheduler-' + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast(T('set.exported'));
}
function importBackup(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(d.app !== 'soyogi_scheduler') throw new Error('different app');
      if(d.plan && Array.isArray(d.plan.items)){ plan = d.plan; saveJSON(LS_PLAN, plan); }
      if(Array.isArray(d.cards)){ customStore = d.cards; saveCustom(); }
      if(d.labels && typeof d.labels === 'object'){ labelStore = d.labels; saveLabels(); }
      pref = sanitizePref(d.prefs); savePref();
      curCat = CAT.CATEGORIES[0].id;
      applyAll();
      toast(T('set.imported'));
    }catch(err){ toast(T('set.importFail')); }
  };
  r.readAsText(f);
  e.target.value = '';
}

/* ---- トースト ---- */
let toastTimer = 0;
function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---- 初期化 ---- */
function init(){
  Timer.mount($('focus-canvas'), $('focus-digital'));
  Timer.onEnd(() => { Sound.ding('timeup'); $('focus-timer-wrap').classList.add('alarm'); });

  Tap.bind($('tab-today'), () => showScreen('scr-today'));
  Tap.bind($('tab-make'),  () => showScreen('scr-make'));
  Tap.bind($('tab-set'),   () => showScreen('scr-set'));

  Tap.bind($('hd-lock'), onLockTap);
  Tap.bind($('btn-lock'), lock);
  Tap.bind($('btn-lock-make'), lock);   // つくる画面の一番下から本人使用モードへ戻る
  Tap.bind($('btn-tapn'), cycleTapN);

  Tap.bind($('btn-focus'), openFocus);
  Tap.bind($('btn-reset'), resetPlan);
  Tap.bind($('focus-close'), closeFocus);
  Tap.bind($('btn-focus-done'), focusDone);

  Tap.bind($('btn-clear'), clearPlan);
  Tap.bind($('btn-custom-add'), addCustom);
  Tap.bind($('btn-photo'), () => $('photo-file').click());
  $('photo-file').addEventListener('change', onPhotoFile);
  bindCropDrag();
  Tap.bind($('crop-ok'), cropConfirm);
  Tap.bind($('crop-cancel'), closeCrop);
  $('crop-range').addEventListener('input', () => cropZoomTo(parseInt($('crop-range').value, 10)));
  $('tpl-select').addEventListener('change', () => {
    const id = $('tpl-select').value; $('tpl-select').value = '';
    if(id) loadTemplate(id);
  });

  Tap.bind($('btn-fs'), () => {
    pref.fs = (pref.fs + 1) % 3;
    applyBodyClass();
    savePref(); applyI18n();
  });
  Tap.bind($('btn-cardsize'), () => {
    pref.cardSize = (pref.cardSize + 1) % 3;
    applyBodyClass();
    savePref(); applyI18n();
  });
  Tap.bind($('btn-fade'),  () => { pref.fadeSec  = (pref.fadeSec  + 1) % 6; savePref(); applyI18n(); });
  Tap.bind($('btn-slide'), () => { pref.slideSec = (pref.slideSec + 1) % 6; savePref(); applyI18n(); });
  Tap.bind($('btn-showtext'), () => { pref.showText = !pref.showText; savePref(); applyI18n(); });
  Tap.bind($('btn-showcount'), () => { pref.showCount = !pref.showCount; savePref(); applyI18n(); });
  Tap.bind($('btn-theme'), () => {
    pref.theme = next(THEMES, pref.theme);
    applyTheme(); savePref(); applyI18n();
  });
  Tap.bind($('btn-bgm'), () => {
    pref.bgm = next(BGMS, pref.bgm);
    applySoundPrefs(); savePref(); applyI18n();
  });
  Tap.bind($('btn-sound'), () => {
    pref.sound = !pref.sound;
    Sound.setEnabled(pref.sound);
    savePref(); applyI18n();
  });
  Tap.bind($('btn-timer'), () => {
    pref.timerStyle = next(TIMER_STYLES, pref.timerStyle);
    Timer.setStyle(pref.timerStyle);
    savePref(); applyI18n();
  });
  Tap.bind($('btn-vol'), () => {
    pref.vol = (pref.vol + 1) % 3;
    Sound.setVol(pref.vol);
    savePref(); applyI18n();
  });

  $('set-lang').addEventListener('change', () => {
    pref.lang = $('set-lang').value;
    savePref(); applyI18n();
  });

  Tap.bind($('bk-export'), exportBackup);
  Tap.bind($('bk-import'), () => $('bk-file').click());
  $('bk-file').addEventListener('change', importBackup);

  if(document.addEventListener){
    document.addEventListener('visibilitychange', () => {
      if(focusing && !wakeLock && document.visibilityState === 'visible') acquireWake();
    });
  }

  applyAll();
  showScreen('scr-today');
  applyLock();

  /* Service Worker: 本番(https)だけ登録。localhost(開発)ではSWを使わず、
     既存の登録とキャッシュを消す = 更新しても「前の版」が出続ける問題を防ぐ(AAC方式) */
  if(typeof navigator !== 'undefined' && 'serviceWorker' in navigator){
    var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname || '');
    if(isLocal){
      navigator.serviceWorker.getRegistrations().then(function(rs){ rs.forEach(function(r){ r.unregister(); }); }).catch(function(){});
      if(typeof caches !== 'undefined' && caches.keys){ caches.keys().then(function(ks){ ks.forEach(function(k){ caches.delete(k); }); }).catch(function(){}); }
    } else if(/^https:/.test(location.protocol)){
      try{ navigator.serviceWorker.register('sw.js'); }catch(_){}
    }
  }
}

init();

})();
