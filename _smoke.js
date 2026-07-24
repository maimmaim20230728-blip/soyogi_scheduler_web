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
tapEl(byId('hd-lock'));   // 解錠中に誤ってヘッダーをもう一度タップ
check('解錠中はヘッダータップでは施錠されない(誤タップ防止)', byId('hd-lock').textContent === '🔓' && !created['tab-make'].classList.contains('hidden'));
tapEl(byId('btn-tapn'));
check('回数ボタンで6かいに ふえる', byId('btn-tapn').textContent === '6かい');
tapEl(byId('btn-lock-make'));
check('つくるの「本人使用モードに もどす」で再施錠', created['tab-make'].classList.contains('hidden') && byId('hd-lock').textContent === '🔒');

console.log('');
if(ng){ console.error('SMOKE NG: ' + ng + '件 失敗 / OK ' + ok + '件'); process.exit(1); }
console.log('SMOKE OK: 全' + ok + '件 合格');
