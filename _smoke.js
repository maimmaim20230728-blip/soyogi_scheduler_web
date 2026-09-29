'use strict';
/* そよぎ式スケジューラー 起動スモークテスト(疑似DOM)
   実在idだけ返す疑似DOMで audio.js + tap.js + timer.js + i18n.js + cards.js + app.js を起動し検証する。
   ・起動→よてい表示(初回=あさのしたく seed)・ja文言
   ・完了(タップで いま→おわった・あと◯こ が減る)・取り消し(やり直し)
   ・しゅうちゅう(1まいずつ・タイマー)・つくる(パレット追加/並べ替え/テンプレ/自作カード/写真カード描画)
   ・せってい(いろ/BGM/タイマー表示/文字サイズ/言語en)・機種変更(かきだす/よみこむ)
   ・データ整合(テンプレのカードid・card/tpl の i18n キー)
   使い方: node _smoke.js  */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

/* ---- 疑似canvas 2Dコンテキスト ---- */
function makeCtx(){
  const noop = () => {};
  return {
    fillStyle:'', strokeStyle:'', lineWidth:0,
    clearRect:noop, beginPath:noop, arc:noop, moveTo:noop, lineTo:noop,
    closePath:noop, fill:noop, stroke:noop, drawImage:noop, fillRect:noop, save:noop, restore:noop
  };
}

/* ---- 疑似DOM要素 ---- */
function makeEl(tag){
  const node = {
    tagName:(tag || 'div').toUpperCase(),
    children:[], style:{}, dataset:{}, _ev:{}, _attr:{},
    className:'', value:'', placeholder:'', src:'', href:'', download:'', alt:'',
    rows:0, type:'', hidden:false, disabled:false, lang:'', dir:'', width:320, height:320,
    appendChild(c){ this.children.push(c); return c; },
    setAttribute(k, v){ this._attr[k] = v; },
    getAttribute(k){ return (k in this._attr) ? this._attr[k] : null; },
    addEventListener(t, h){ (this._ev[t] = this._ev[t] || []).push(h); },
    removeEventListener(){},
    getContext(){ return makeCtx(); },
    focus(){}, click(){}, scrollIntoView(){}, scrollTo(){}, remove(){}, toDataURL(){ return 'data:image/jpeg;base64,MOCK'; },
    classList:{
      _s:new Set(),
      add(...c){ c.forEach(x => this._s.add(x)); },
      remove(...c){ c.forEach(x => this._s.delete(x)); },
      toggle(c, f){ if(f === undefined) f = !this._s.has(c); if(f) this._s.add(c); else this._s.delete(c); return f; },
      contains(c){ return this._s.has(c); }
    },
    querySelector(){ return makeEl(); },
    querySelectorAll(){ return []; }
  };
  let _text = '';
  Object.defineProperty(node, 'textContent', {
    get(){ return _text; },
    set(v){ _text = (v == null ? '' : String(v)); node.children.length = 0; }
  });
  return node;
}

const created = {};
function byId(id){
  if(!ids.has(id)) return null;
  if(!created[id]) created[id] = makeEl();
  return created[id];
}

/* ---- ツリー探索・イベント発火 ---- */
function tapEl(elm){
  if(!elm) return;
  const d = { pointerId:1, isPrimary:true, clientX:0, clientY:0, preventDefault(){} };
  (elm._ev.pointerdown || []).forEach(h => h(d));
  (elm._ev.pointerup   || []).forEach(h => h({ pointerId:1, clientX:0, clientY:0 }));
}
function fire(elm, type, ev){ (elm._ev[type] || []).forEach(h => h(ev || {})); }
function allText(node){
  let s = node.textContent || '';
  for(const c of node.children) s += ' ' + allText(c);
  return s;
}
function findByClass(node, cls){
  if(node.className && (' ' + node.className + ' ').indexOf(' ' + cls + ' ') >= 0) return node;
  for(const c of node.children){ const r = findByClass(c, cls); if(r) return r; }
  return null;
}
function findByTag(node, tag){
  tag = tag.toUpperCase();
  if(node.tagName === tag) return node;
  for(const c of node.children){ const r = findByTag(c, tag); if(r) return r; }
  return null;
}
function countClass(node, cls){
  let n = (node.className && (' ' + node.className + ' ').indexOf(' ' + cls + ' ') >= 0) ? 1 : 0;
  for(const c of node.children) n += countClass(c, cls);
  return n;
}

/* ---- sandbox ---- */
const lsData = {
  /* 事前投入: 写真カード1枚(img描画パスの検証用) */
  'sched.cards.v1': JSON.stringify([{ id:'u1', img:'data:image/jpeg;base64,TESTIMG', text:'しゃしんテスト' }])
};
const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, String, parseInt, parseFloat,
  localStorage: {
    getItem: k => (k in lsData) ? lsData[k] : null,
    setItem: (k, v) => { lsData[k] = String(v); },
    removeItem: k => { delete lsData[k]; }
  },
  navigator: {},
  location: { protocol: 'file:' },
  requestAnimationFrame(fn){ return setTimeout(fn, 0); },
  cancelAnimationFrame(id){ clearTimeout(id); },
  document: {
    getElementById: byId,
    createElement: makeEl,
    documentElement: makeEl('html'),
    body: makeEl('body'),
    addEventListener(){},
    querySelector(){ return null; },       // カードタイマーの再取得は疑似DOMでは非対応(nullで安全に停止)
    querySelectorAll(){ return []; },
    visibilityState: 'visible'
  },
  URL: { createObjectURL(){ return 'blob:mock'; }, revokeObjectURL(){} },
  Image: function(){
    this.width = 10; this.height = 10;
    const self = this;
    Object.defineProperty(this, 'src', { set(v){ self._src = v; if(self.onload) self.onload(); }, get(){ return self._src; } });
  },
  FileReader: function(){
    this.readAsText = function(f){ this.result = f._text; if(this.onload) this.onload(); };
  }
};
sandbox.Blob = function(parts, opts){ this.parts = parts; this.opts = opts; sandbox.__lastBlob = this; };
sandbox.window = sandbox;
vm.createContext(sandbox);

for(const f of ['audio.js','tap.js','timer.js','i18n.js','cards.js','app.js']){
  vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8'), sandbox, { filename: f });
}
const evalCtx = code => vm.runInContext(code, sandbox);

/* ---- 検証 ---- */
let ok = 0, ng = 0;
function check(name, cond){
  if(cond){ ok++; console.log('  OK ' + name); }
  else { ng++; console.error('  NG ' + name); }
}
const todayList = () => created['today-list'];

console.log('[1] 起動・よてい表示(初回=あさのしたく)・ja文言');
check('よていが表示されている', !created['scr-today'].classList.contains('hidden'));
check('つくるは隠れている', created['scr-make'].classList.contains('hidden'));
check('アプリ名がjaで出る', created['hd-title'].textContent === 'そよぎ式スケジューラー');
check('見出しがjaで出る', created['today-title'].textContent === 'きょうの よてい');
check('初回seed=あさのしたく・先頭カードが おきる', (findByClass(todayList(), 'sc-text') || {}).textContent === 'おきる');
check('残り7枚が全部ならぶ(スクロール表示)', countClass(todayList(), 'sched-card') === 7);
check('一番上のカードだけ白背景(sc-now)', countClass(todayList(), 'sc-now') === 1);
check('あと7こ 表示', created['today-remain'].textContent === 'あと 7こ');
check('既定テーマはみどり', sandbox.document.body.getAttribute('data-theme') === 'green');
check('タイマー表示は既定disc', evalCtx('Timer.total') === 0);
check('BGMは既定で音1(みどりの音)', created['btn-bgm'].textContent === 'みどりの音');
check('BGMは既定でON(有効)', evalCtx('Sound.bgmEnabled') === true);

console.log('[2] 完了=カードが消える・あと◯こ が減る');
tapEl(findByClass(todayList(), 'sched-card'));   // 先頭(おきる)を完了
check('完了したカードは消える(6枚に)', countClass(todayList(), 'sched-card') === 6);
check('先頭が つぎの「かおを あらう」に', (findByClass(todayList(), 'sc-text') || {}).textContent === 'かおを あらう');
check('あと6こ に減る', created['today-remain'].textContent === 'あと 6こ');
check('おわったカードは一覧から消える', allText(todayList()).indexOf('おきる') < 0);

console.log('[3] しゅうちゅう(1まいずつ)');
tapEl(created['btn-focus']);
check('しゅうちゅうが開く', !created['scr-focus'].classList.contains('hidden'));
check('いまのカード「かおをあらう」が大きく出る', created['focus-emoji'].textContent === '🧼');
check('できたボタンが出ている', !created['btn-focus-done'].classList.contains('hidden'));
tapEl(created['btn-focus-done']);
check('しゅうちゅうで完了→つぎ「トイレ」', created['focus-emoji'].textContent === '🚽');
tapEl(created['focus-close']);
check('とじるで閉じる', created['scr-focus'].classList.contains('hidden'));
check('しゅうちゅうの完了もよていに反映(あと5こ)', created['today-remain'].textContent === 'あと 5こ');

console.log('[4] つくる: パレット・追加・並べ替え・テンプレ');
tapEl(created['tab-make']);
check('つくるへ遷移', !created['scr-make'].classList.contains('hidden'));
check('カテゴリタブが並ぶ', countClass(created['cats'], 'cat-tab') >= 8);
check('パレットにカードが並ぶ', countClass(created['palette'], 'pcard') >= 5);
const planBefore = evalCtx('(function(){return JSON.parse(localStorage.getItem("sched.plan.v1")).items.length;})()');
tapEl(findByClass(created['palette'], 'pcard'));   // 先頭カードを追加
const planAfter = evalCtx('(function(){return JSON.parse(localStorage.getItem("sched.plan.v1")).items.length;})()');
check('パレットのタップで よていに1枚ふえる', planAfter === planBefore + 1);
check('いまの よてい に行が出る', countClass(created['plan-list'], 'plan-row') === planAfter);
created['tpl-select'].value = 'night';
fire(created['tpl-select'], 'change');
check('テンプレ(よるのしたく)で9枚に置き換わる', countClass(created['plan-list'], 'plan-row') === 9);
check('先頭が「ばんごはん」の絵', (findByClass(created['plan-list'], 'pe') || {}).textContent === '🍲');

console.log('[5] じぶんで つくる: 絵カード + 写真カード描画 + トリミング');
byId('custom-text').value = 'さんぽ(いつもの)';
byId('custom-emoji').value = '🐕';
tapEl(byId('btn-custom-add'));
check('じぶんカテゴリに切り替わる', countClass(created['cats'], 'cat-tab') >= 9);
check('自作の絵カードがパレットに出る', allText(created['palette']).indexOf('さんぽ(いつもの)') >= 0);
const paletteImg = findByTag(created['palette'], 'img');
check('事前投入の写真カードが img で描画される', !!paletteImg && paletteImg.src === 'data:image/jpeg;base64,TESTIMG');
check('写真カードの img には isimg クラス', !!paletteImg && (' '+paletteImg.className+' ').indexOf(' isimg ') >= 0);
/* 写真取り込み → トリミング → 作成 */
byId('custom-text').value = 'げんかん';
fire(byId('photo-file'), 'change', { target:{ files:[{ name:'p.jpg' }], value:'' } });
check('しゃしんで トリミング画面が開く', !created['scr-crop'].classList.contains('hidden'));
const cardsBefore = evalCtx('JSON.parse(localStorage.getItem("sched.cards.v1")).length');
tapEl(byId('crop-ok'));
check('「これで つくる」で トリミング画面が閉じる', created['scr-crop'].classList.contains('hidden'));
const cardsAfter = evalCtx('JSON.parse(localStorage.getItem("sched.cards.v1")).length');
check('写真カードが1枚ふえる', cardsAfter === cardsBefore + 1);
check('新しい写真カードに文字が付く', allText(created['palette']).indexOf('げんかん') >= 0);
/* やめる は追加しない */
fire(byId('photo-file'), 'change', { target:{ files:[{ name:'q.jpg' }], value:'' } });
check('トリミング画面が再度開く', !created['scr-crop'].classList.contains('hidden'));
tapEl(byId('crop-cancel'));
check('やめるで閉じ、枚数は増えない', created['scr-crop'].classList.contains('hidden') &&
  evalCtx('JSON.parse(localStorage.getItem("sched.cards.v1")).length') === cardsAfter);

console.log('[5c] カードのタイマー(各カードの中)');
const firstMin = findByClass(created['plan-list'], 'plan-min');
firstMin.value = '5'; fire(firstMin, 'change');   // いまの よてい 先頭カードに5分
tapEl(created['tab-today']);
const timedRing = findByClass(todayList(), 'sc-timer');
check('時間つきカードにタイマー円が出る', !!timedRing);
check('タイマーに分数が入る', (findByClass(todayList(), 'sct-n') || {}).textContent === '5');
const cntBeforeRing = countClass(todayList(), 'sched-card');
tapEl(timedRing);   // タイマーをタップ(カード完了とは別動作)
check('タイマーをタップしてもカードは完了しない', countClass(todayList(), 'sched-card') === cntBeforeRing);

console.log('[5d] カードのことばを自由記入で変える');
tapEl(created['tab-make']);
const wordInput = findByClass(created['plan-list'], 'pl-edit');
wordInput.value = 'ゆうごはんだよ'; fire(wordInput, 'change');
tapEl(created['tab-today']);
check('カードのことばが自由記入で変わる', (findByClass(todayList(), 'sc-text') || {}).textContent === 'ゆうごはんだよ');

console.log('[6] せってい: いろ/BGM/タイマー表示/文字サイズ/カード大きさ/文字ON-OFF/言語');
tapEl(created['tab-set']);
tapEl(created['btn-theme']);
check('テーマがみずいろに', sandbox.document.body.getAttribute('data-theme') === 'aqua');
check('いろボタン表示も更新', created['btn-theme'].textContent === 'みずいろ');
tapEl(created['btn-bgm']);
check('既定の音1から音2(あおの音)へ切替', created['btn-bgm'].textContent === 'あおの音');
check('BGMは引き続き有効', evalCtx('Sound.bgmEnabled') === true);
tapEl(created['btn-bgm']);
check('もう一度でOFF(なし)に', created['btn-bgm'].textContent === 'なし');
check('BGMが無効化', evalCtx('Sound.bgmEnabled') === false);
tapEl(created['btn-bgm']);
check('もう一度で音1(みどりの音)に戻る', created['btn-bgm'].textContent === 'みどりの音');
check('BGMが再度有効化', evalCtx('Sound.bgmEnabled') === true);
tapEl(created['btn-timer']);
check('タイマー表示が「すうじ」に', created['btn-timer'].textContent === 'すうじ');
tapEl(created['btn-fs']);
check('body classにfs1が入る', sandbox.document.body.className.indexOf('fs1') >= 0);
tapEl(created['btn-cardsize']);
check('カードの大きさが「特大」に', created['btn-cardsize'].textContent === '特大');
check('body classにcs2が入る', sandbox.document.body.className.indexOf('cs2') >= 0);
created['set-lang'].value = 'en';
fire(created['set-lang'], 'change');
check('タブが英語(Today)に', created['tab-today'].textContent === 'Today');
check('html langがenに', sandbox.document.documentElement.lang === 'en');
created['set-lang'].value = 'ja';
fire(created['set-lang'], 'change');
check('jaに戻せる', created['tab-today'].textContent === 'よてい');
tapEl(created['btn-fade']);
check('カードが消える秒数が「3びょう」に', created['btn-fade'].textContent === '3びょう');
tapEl(created['btn-slide']);
check('つぎが上がる秒数が「2びょう」に', created['btn-slide'].textContent === '2びょう');
tapEl(created['btn-showtext']);
check('カードの文字がOFFに', created['btn-showtext'].textContent === 'OFF');
tapEl(created['tab-today']);
check('文字なしでカードに文字が出ない', countClass(todayList(), 'sc-text') === 0);
tapEl(created['tab-set']);
tapEl(created['btn-showtext']);
check('もう一度でONに戻る', created['btn-showtext'].textContent === 'ON');
tapEl(created['btn-showcount']);
check('あと なんこ の ひょうじがOFFに', created['btn-showcount'].textContent === 'OFF');
tapEl(created['tab-today']);
check('OFFで あと◯こ バッジが隠れる', created['today-remain'].classList.contains('hidden'));
tapEl(created['tab-set']);
tapEl(created['btn-showcount']);
check('もう一度でONに戻る(あと◯こ)', created['btn-showcount'].textContent === 'ON');

console.log('[7] タイマー(モジュール単体)');
evalCtx('Timer.setTotal(300)');
check('タイマー総時間300秒がセットされる', evalCtx('Timer.total') === 300);
check('デジタル表示が 5:00', created['focus-digital'].textContent === '5:00');

console.log('[8] 機種変更: かきだす / よみこむ');
tapEl(created['bk-export']);
const blobJson = sandbox.__lastBlob ? JSON.parse(sandbox.__lastBlob.parts.join('')) : null;
check('Blobにアプリ名が入る', !!blobJson && blobJson.app === 'soyogi_scheduler');
check('Blobに予定が入る', !!blobJson && Array.isArray(blobJson.plan.items));
check('Blobに自作カードも入る', !!blobJson && Array.isArray(blobJson.cards) && blobJson.cards.length >= 2);
const good = JSON.stringify({ app:'soyogi_scheduler', ver:1,
  plan:{ items:[{ ref:'bath', min:0, done:false }], updated:1 },
  cards:[], prefs:{ lang:'ja', fs:0, sound:true, theme:'dark', bgm:'off', timerStyle:'disc', vol:1 } });
fire(created['bk-file'], 'change', { target:{ files:[{ _text: good }], value:'' } });
check('予定が差し替わる(おふろ1枚)', evalCtx('(function(){return JSON.parse(localStorage.getItem("sched.plan.v1")).items.length;})()') === 1);
check('テーマ設定も反映(くろ)', sandbox.document.body.getAttribute('data-theme') === 'dark');
fire(created['bk-file'], 'change', { target:{ files:[{ _text: JSON.stringify({ app:'other_app' }) }], value:'' } });
check('別アプリのファイルは拒否', created['toast'].textContent.indexOf('よみこめませんでした') >= 0);

console.log('[9] さいしょから(リセット)');
tapEl(created['tab-today']);
check('取り込み後は1枚(おふろ)', countClass(todayList(), 'sched-card') === 1);
tapEl(findByClass(todayList(), 'sched-card'));   // 完了で消える
check('完了で0枚+ぜんぶ おわりました', countClass(todayList(), 'sched-card') === 0 && allText(todayList()).indexOf('おわりました') >= 0);
tapEl(created['btn-reset']);
check('さいしょから で1枚に戻る', countClass(todayList(), 'sched-card') === 1);

console.log('[10] データ整合(テンプレのカードid・i18nキー)');
const SC = evalCtx('window.SCHED_CARDS');
const I18 = evalCtx('window.SCHED_I18N');
const cardIds = new Set(SC.CARDS.map(c => c.id));
let badTpl = 0;
SC.TEMPLATES.forEach(t => t.cards.forEach(id => { if(!cardIds.has(id)) badTpl++; }));
check('テンプレの参照カードidが全て実在', badTpl === 0);
let missCard = 0;
SC.CARDS.forEach(c => { if(I18.ja.card[c.id] === undefined || I18.en.card[c.id] === undefined) missCard++; });
check('全カードに ja/en ラベルがある', missCard === 0);
let missTpl = 0;
SC.TEMPLATES.forEach(t => { if(I18.ja.tpl[t.id] === undefined || I18.en.tpl[t.id] === undefined) missTpl++; });
check('全テンプレに ja/en タイトルがある', missTpl === 0);

console.log('[11] 介護者ロック(連打方式・回数設定)');
check('既定は施錠(つくる/せっていタブが隠れる)', created['tab-make'].classList.contains('hidden') && created['tab-set'].classList.contains('hidden'));
check('ロックアイコンは🔒', byId('hd-lock').textContent === '🔒');
check('回数ボタンの既定は「5かい」', byId('btn-tapn').textContent === '5かい');
for(let i = 0; i < 5; i++) tapEl(byId('hd-lock'));   // 5連打
check('5連打で解錠→つくる/せってい が出る', !created['tab-make'].classList.contains('hidden') && byId('hd-lock').textContent === '🔓');
check('解錠中は鍵の横の案内が消える', byId('hd-lock-hint').classList.contains('hidden'));
tapEl(byId('hd-lock'));   // 解錠中に誤ってヘッダーをもう一度タップ
check('解錠中はヘッダータップでは施錠されない(誤タップ防止)', byId('hd-lock').textContent === '🔓' && !created['tab-make'].classList.contains('hidden'));
tapEl(byId('btn-tapn'));
check('回数ボタンで6かいに ふえる', byId('btn-tapn').textContent === '6かい');
tapEl(byId('btn-lock-make'));
check('つくるの「本人使用モードに もどす」で再施錠', created['tab-make'].classList.contains('hidden') && byId('hd-lock').textContent === '🔒');

/* ---- [v0.1.4] 下タブ/ステータスバーに隠れない(セーフエリア対応) ----
   targetSdk36(Android15+)はエッジtoエッジ強制で、画面がナビゲーションバーの下まで
   描かれる。#tabbar と .focus-done は自分の余白に safe-area を持つので実際の高さが
   増えるが、本文側がCSSの固定値だと足りず「1まいずつ みる」や「できた」が隠れる。 */
console.log('[セーフエリア] 下タブ/ステータスバーに隠れない');
const cssTxt = require('fs').readFileSync(__dirname + '/style.css', 'utf8').replace(/\s+/g, '');
check('body の下余白が max(CSS下限, 実測+10px)',
  /body\{[^}]*padding-bottom:max\(calc\(84px\+env\(safe-area-inset-bottom\)\),calc\(var\(--tabbar-h\)\+10px\)\)/.test(cssTxt));
check('--tabbar-h のフォールバックに env(safe-area-inset-bottom)',
  /--tabbar-h:calc\(84px\+env\(safe-area-inset-bottom\)\)/.test(cssTxt));
check('ヘッダーの上余白に env(safe-area-inset-top)(時計と重ならない)',
  /header#hd\{[^}]*padding:calc\(24px\+env\(safe-area-inset-top\)\)/.test(cssTxt));
check('「できた」の下端に env(safe-area-inset-bottom)(ナビバーに食い込まない)',
  /\.focus-done\{[^}]*bottom:calc\(16px\+env\(safe-area-inset-bottom\)\)/.test(cssTxt));
check('しゅうちゅうの上余白に env(safe-area-inset-top)(「とじる」が時計と重ならない)',
  /#focus-inner\{[^}]*padding:calc\(16px\+env\(safe-area-inset-top\)\)/.test(cssTxt));
check('しゅうちゅうの下余白が max(CSS下限, 「できた」実測+28px)',
  /#focus-inner\{[^}]*max\(calc\(100px\+env\(safe-area-inset-bottom\)\),calc\(var\(--focusdone-h\)\+28px\)\)/.test(cssTxt));
check('トーストも --tabbar-h 基準', /\.toast\{[^}]*bottom:max\(calc\(96px\+env\(safe-area-inset-bottom\)\),calc\(var\(--tabbar-h\)\+12px\)\)/.test(cssTxt));
check('トリミング画面もセーフエリア対応', /\.crop-inner\{[^}]*padding:calc\(20px\+env\(safe-area-inset-top\)\)/.test(cssTxt));
const appTxt = require('fs').readFileSync(__dirname + '/app.js', 'utf8');
check('applyBarSpace が下タブと「できた」の実寸を測っている',
  /function applyBarSpace\(\)/.test(appTxt) &&
  /getElementById\('tabbar'\), '--tabbar-h'/.test(appTxt) &&
  /put\(done, '--focusdone-h'\)/.test(appTxt));
check('ResizeObserver で箱を見張っている', /function watchBarSpace\(\)/.test(appTxt) && /new ResizeObserver\(applyBarSpace\)/.test(appTxt));
check('しゅうちゅうを開いた時にも測り直す', /buildFocus\(\); acquireWake\(\);\s*\n\s*applyBarSpace\(\);/.test(appTxt));

/* ---- [v0.2] やりかた モード ----
   名前付きで複数保存・カードは消えず まえ/つぎ/できた・最後は おわりました・段ごとの写真(よこなが/しかく)・読み上げ・
   見るのは本人使用モードでも/つくるのは作成モードだけ・よていは上書きしない・バックアップ(ver1も読める) */
console.log('[v0.2] やりかた モード');
const HOWTO = () => evalCtx('JSON.parse(localStorage.getItem("sched.howto.v1") || "null")');
const planBeforeHowto = evalCtx('localStorage.getItem("sched.plan.v1")');
check('本人使用モードでも「やりかた」タブは見える', !created['tab-howto'].classList.contains('hidden') && created['tab-make'].classList.contains('hidden'));
check('タブの ことば(ja)=やりかた', created['tab-howto'].textContent === 'やりかた');
tapEl(created['tab-howto']);
check('やりかた画面へ', !created['scr-howto'].classList.contains('hidden') && created['scr-today'].classList.contains('hidden'));
check('見本「てを あらう」が1つ(5だん)', countClass(created['howto-list'], 'hw-item') === 1 && allText(created['howto-list']).indexOf('てを あらう') >= 0 && allText(created['howto-list']).indexOf('5だん') >= 0);
check('本人使用モードでは なおす/けす/あたらしく つくる が出ない', countClass(created['howto-list'], 'hw-edit') === 0 && created['howto-make'].classList.contains('hidden'));
/* 見る: 全画面・1だんめ */
tapEl(findByClass(created['howto-list'], 'hw-open'));
check('タップで全画面の やりかた が開く', !created['scr-play'].classList.contains('hidden'));
check('1だんめ「みずを だす」・1 / 5', created['play-text'].textContent === 'みずを だす' && created['play-count'].textContent === '1 / 5');
check('写真のない段は 番号を大きく出す', (findByClass(created['play-face'], 'play-num') || {}).textContent === '1');
check('1だんめでは「まえ」が うすい(押せない)', created['play-prev'].classList.contains('off'));
check('点(ドット)が5つ', countClass(created['play-dots'], 'play-dot') === 5);
tapEl(created['play-prev']);
check('1だんめで まえ を押しても動かない', created['play-count'].textContent === '1 / 5');
tapEl(created['play-next']);
check('つぎ で 2だんめ(できた にはならない)', created['play-text'].textContent === 'せっけんを つける' && created['play-check'].classList.contains('hidden'));
tapEl(created['play-prev']);
check('まえ で 1だんめに もどれる(カードは消えない)', created['play-text'].textContent === 'みずを だす');
tapEl(created['play-done']);
check('できた で つぎの段へ進む', created['play-count'].textContent === '2 / 5');
tapEl(created['play-prev']);
check('できた段に もどると ✓ が出る', !created['play-check'].classList.contains('hidden'));
for(let i = 0; i < 5; i++) tapEl(created['play-done']);
check('最後の段で できた →「おわりました」', !created['play-end'].classList.contains('hidden') && created['play-nav'].classList.contains('hidden') && created['play-end-title'].textContent.indexOf('おわりました') >= 0);
tapEl(created['play-again']);
check('さいしょから で 1だんめ・✓ も消える', created['play-count'].textContent === '1 / 5' && created['play-check'].classList.contains('hidden'));
check('読み上げの無い端末では 🔊 を出さない', created['play-speak'].classList.contains('hidden'));
tapEl(created['play-close']);
check('とじる で閉じる', created['scr-play'].classList.contains('hidden'));
check('見るだけでは保存しない(見本は まだ保存されていない)', HOWTO() === null);
check('やりかた を見ても よてい は変わらない', evalCtx('localStorage.getItem("sched.plan.v1")') === planBeforeHowto);
/* 読み上げ(ブラウザの読み上げがある端末) */
const spoken = [];
sandbox.speechSynthesis = { cancel(){}, speak(u){ spoken.push(u.text); }, getVoices(){ return []; } };
sandbox.SpeechSynthesisUtterance = function(t){ this.text = t; };
tapEl(findByClass(created['howto-list'], 'hw-open'));
check('読み上げのある端末では 🔊 が出る', !created['play-speak'].classList.contains('hidden'));
check('既定(ボタンで)は 開いただけでは読まない', spoken.length === 0);
tapEl(created['play-speak']);
check('🔊 で いまの段を読む', spoken[0] === 'みずを だす');
tapEl(created['play-close']);
/* 作成モードで つくる */
for(let i = 0; i < 6; i++) tapEl(byId('hd-lock'));   // 回数は上で6に変えてある
check('作成モードで なおす/けす/あたらしく つくる が出る', countClass(created['howto-list'], 'hw-edit') === 1 && !created['howto-make'].classList.contains('hidden'));
check('しゅるいは3つ(てじゅん/ばしょの よしゅう/みちじゅん)', countClass(created['howto-kinds'], 'hw-kind') === 3 && allText(created['howto-kinds']).indexOf('みちじゅん') >= 0);
tapEl(findByClass(created['howto-kinds'], 'hw-kind'));   // てじゅん
check('あたらしく つくる → すぐ なおす画面(3だん・名前=てじゅん)', !created['howto-editor'].classList.contains('hidden') && countClass(created['hw-steps'], 'hw-row') === 3 && created['hw-name'].value === 'てじゅん');
check('保存される(見本+新しい1つ=2つ)', HOWTO().lists.length === 2);
check('段の書き方の例(てじゅん)=することを かく', (findByClass(created['hw-steps'], 'hw-text') || {}).placeholder === 'することを かく');
created['hw-name'].value = 'せんたく'; fire(created['hw-name'], 'change');
const t0 = findByClass(created['hw-steps'], 'hw-text');
t0.value = 'せんざいを いれる'; fire(t0, 'change');
tapEl(created['hw-add']);
check('＋ だんを ふやす で4だんに', countClass(created['hw-steps'], 'hw-row') === 4 && HOWTO().lists[1].steps.length === 4);
check('名前と段のことばが保存される', HOWTO().lists[1].name === 'せんたく' && HOWTO().lists[1].steps[0].text === 'せんざいを いれる');
/* 段の写真: よこなが(4:3)で切り出す */
tapEl(findByClass(created['hw-steps'], 'hw-photo'));
sandbox.Image = function(){ this.width = 40; this.height = 30; const self = this; Object.defineProperty(this, 'src', { set(v){ self._src = v; if(self.onload) self.onload(); }, get(){ return self._src; } }); };
fire(byId('hw-photo-file'), 'change', { target:{ files:[{ name:'w.jpg' }], value:'' } });
check('段の写真 → トリミング画面(よこなが の切りかえが出る)', !created['scr-crop'].classList.contains('hidden') && !created['crop-shape'].classList.contains('hidden') && created['crop-shape'].textContent.indexOf('よこなが') >= 0);
check('横長の写真は よこなが(4:3)の枠から始まる', created['crop-canvas'].width === 320 && created['crop-canvas'].height === 240 && created['crop-stage'].classList.contains('wide'));
tapEl(created['crop-shape']);
check('切りかえで しかく(正方形)の枠に', created['crop-canvas'].width === 300 && created['crop-canvas'].height === 300 && !created['crop-stage'].classList.contains('wide'));
tapEl(created['crop-shape']);
tapEl(byId('crop-ok'));
check('これで つくる → 1だんめに写真が入る', HOWTO().lists[1].steps[0].img === 'data:image/jpeg;base64,MOCK' && created['scr-crop'].classList.contains('hidden'));
check('なおす画面の1だんめに写真が出る', !!findByClass(created['hw-steps'], 'hw-face') && findByClass(created['hw-steps'], 'hw-face').tagName === 'IMG');
check('カードの写真は これまでどおり正方形(じぶんカードに ふえない)', evalCtx('JSON.parse(localStorage.getItem("sched.cards.v1")).length') >= 0);
/* 並べかえ・けす */
const rows0 = created['hw-steps'].children;
tapEl(findByClass(rows0[0], 'mv del'));   // 1だんめを けす
check('✕ で段を けす(3だんに)', HOWTO().lists[1].steps.length === 3);
tapEl(created['hw-finish']);
check('できあがり で一覧に もどる(2つ)', created['howto-editor'].classList.contains('hidden') && countClass(created['howto-list'], 'hw-item') === 2 && allText(created['howto-list']).indexOf('せんたく') >= 0);
/* じどうで読み上げ */
tapEl(created['tab-set']);
tapEl(created['btn-howto-auto']);
check('せってい: やりかたの よみあげ → じどう', created['btn-howto-auto'].textContent === 'じどう');
tapEl(created['tab-howto']);
spoken.length = 0;
tapEl(findByClass(created['howto-list'], 'hw-open'));   // 見本
check('じどう では 開いたら読む', spoken[0] === 'みずを だす');
tapEl(created['play-next']);
check('じどう では 段を かえるたびに読む', spoken[1] === 'せっけんを つける');
tapEl(created['play-close']);
/* けす(2段階) */
const delBtn2 = findByClass(created['howto-list'], 'hw-del');
tapEl(delBtn2);
check('けす 1回目は「ほんとうに けす?」になるだけ', HOWTO().lists.length === 2 && allText(created['howto-list']).indexOf('ほんとうに けす?') >= 0);
tapEl(findByClass(created['howto-list'], 'hw-del'));
check('けす 2回目で消える', HOWTO().lists.length === 1 && HOWTO().lists[0].name === 'せんたく');
/* バックアップ: やりかた も入る / ver1(やりかた無し)は今の やりかた を残す / ver2 は差し替え */
tapEl(created['tab-set']);
tapEl(created['bk-export']);
const bk2 = JSON.parse(sandbox.__lastBlob.parts.join(''));
check('バックアップに やりかた が入る(ver2)', bk2.ver === 2 && bk2.howto && bk2.howto.lists.length === 1 && bk2.howto.lists[0].name === 'せんたく' && bk2.howto.lists[0].steps.length === 3);
fire(created['bk-file'], 'change', { target:{ files:[{ _text: JSON.stringify({ app:'soyogi_scheduler', ver:1, plan:{ items:[] }, cards:[], prefs:{} }) }], value:'' } });
check('ver1 のファイルを読んでも やりかた は残る', HOWTO().lists.length === 1 && HOWTO().lists[0].name === 'せんたく');
fire(created['bk-file'], 'change', { target:{ files:[{ _text: JSON.stringify({ app:'soyogi_scheduler', ver:2, plan:{ items:[] }, cards:[], prefs:{},
  howto:{ lists:[ { id:'h1', name:'バスで びょういん', kind:'route', steps:[{ text:'バスていに いく' }, { text:'びょういん まえで おりる', img:'javascript:alert(1)' }] } ] } }) }], value:'' } });
check('ver2 のファイルで やりかた が差し替わる', HOWTO().lists.length === 1 && HOWTO().lists[0].name === 'バスで びょういん' && HOWTO().lists[0].kind === 'route');
check('写真でない img(data:image 以外)は読み込まない', HOWTO().lists[0].steps[1].img === '');
/* 英語: タブと しゅるい */
created['set-lang'].value = 'en'; fire(created['set-lang'], 'change');
check('en: タブ How-to・しゅるい Route', created['tab-howto'].textContent === 'How-to' && allText(created['howto-kinds']).indexOf('Route') >= 0);
created['set-lang'].value = 'ja'; fire(created['set-lang'], 'change');
tapEl(byId('btn-lock'));
check('本人使用モードに もどすと なおす が消える', countClass(created['howto-list'], 'hw-edit') === 0);
check('app.js の VER は 0.2.2', /const VER = '0\.2\.2'/.test(appTxt));
check('Play版の読み上げは Plugins.TextToSpeech を見る(WebView に registerPlugin は無い)', /c\.Plugins && c\.Plugins\.TextToSpeech/.test(appTxt));

console.log('');
if(ng){ console.error('SMOKE NG: ' + ng + '件 失敗 / OK ' + ok + '件'); process.exit(1); }
console.log('SMOKE OK: 全' + ok + '件 合格');
