'use strict';
/* そよぎ式スケジューラー 禁句・整合チェック(提出前に必ず実行)
   ・13歳以上方針: 子ども/知育系の語をアプリ表示文言・ストア文言から排除
   ・ダッシュ「—」不使用(ヒロ名義の日本語文章共通ルール)
   ・「加盟店」「給付」不使用(そよぎ共通の言い換えルール)
   ・i18n.js の言語間キー構造チェック(ja=正・配列要素数も一致)
   ・sw.js の ASSETS 実在チェック(キャッシュ切れ=オフライン起動死の予防)
   使い方: node _check.js  */
const fs = require('fs');
const path = require('path');

const TARGETS = ['index.html','app.js','cards.js','i18n.js','manifest.json','style.css'];
const storeDir = path.join(__dirname, 'store');
if(fs.existsSync(storeDir)){
  for(const f of fs.readdirSync(storeDir)){
    if(/\.(md|txt|js|html)$/.test(f)) TARGETS.push('store/' + f);
  }
}

const RULES = [
  { re:/子ども|こども|子供|キッズ|知育|児童/g, level:'error', why:'13歳以上方針(feedback-play-target-13plus)' },
  { re:/—/g,        level:'error', why:'ダッシュ不使用ルール' },
  { re:/加盟店/g,    level:'error', why:'「取扱店」と言う(JPYC公式見解)' },
  { re:/給付/g,      level:'error', why:'「送付」と言う(行政語回避)' }
];

let errors = 0, warns = 0;
for(const t of TARGETS){
  const p = path.join(__dirname, t);
  if(!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split('\n');
  for(const rule of RULES){
    lines.forEach((line, i) => {
      rule.re.lastIndex = 0;
      if(rule.re.test(line)){
        const msg = `${t}:${i + 1} 「${line.trim().slice(0, 60)}」 ← ${rule.why}`;
        if(rule.level === 'error'){ errors++; console.error('NG  ' + msg); }
        else { warns++; console.warn('WARN ' + msg); }
      }
    });
  }
}

/* アラビア語(右から左)で崩れないよう、style.css に 左右固定の指定を残さない(2026-11-11)。
   text-align:left/right・float・margin/padding/border の left/right は start/end(margin-inline-end など)にする。
   端末の切り欠きを避ける env(safe-area-inset-left/right) は 物理的な左右でよいので 見逃す。
   position:fixed の left:0; right:0 のような 左右対称の指定は 対象外 */
{
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  css.split('\n').forEach((line, i) => {
    const bad = /text-align\s*:\s*(left|right)\b|float\s*:\s*(left|right)\b|(margin|padding)-(left|right)\s*:|border-(left|right)(-\w+)?\s*:/.test(line);
    if(bad && !/safe-area-inset/.test(line)){
      errors++; console.error('NG  style.css:' + (i + 1) + ' 左右固定の指定(アラビア語で崩れる): ' + line.trim().slice(0, 70));
    }
  });
}

/* i18n.js の言語間キー構造チェック(ja=正 と他言語の構造完全一致・配列は要素数も一致) */
const vm = require('vm');
const i18nSandbox = { window:{} };
vm.createContext(i18nSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'i18n.js'), 'utf8'), i18nSandbox, { filename:'i18n.js' });
const TBL = i18nSandbox.window.SCHED_I18N || {};
function shape(o, prefix){
  const out = [];
  for(const k of Object.keys(o).sort()){
    const v = o[k], p = (prefix ? prefix + '.' : '') + k;
    if(Array.isArray(v)) out.push(p + '[' + v.length + ']');
    else if(v && typeof v === 'object') out.push(...shape(v, p));
    else out.push(p);
  }
  return out;
}
if(!TBL.ja){
  errors++; console.error('NG  i18n.js: ja テーブルが読めません');
} else {
  const jaShape = shape(TBL.ja, '').join('\n');
  for(const lang of Object.keys(TBL)){
    if(lang === 'ja') continue;
    if(shape(TBL[lang], '').join('\n') !== jaShape){
      errors++;
      console.error('NG  i18n.js: ' + lang + ' のキー構造が ja と一致しません');
    }
  }
}

/* sw.js ASSETS の実在チェック */
const sw = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
const assets = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(a => a !== '');
for(const a of assets){
  if(!fs.existsSync(path.join(__dirname, a))){
    errors++; console.error('NG  sw.js ASSETS に実在しないファイル: ' + a);
  }
}

console.log('');
if(errors){ console.error('CHECK NG: エラー' + errors + '件 / 警告' + warns + '件'); process.exit(1); }
console.log('CHECK OK: エラー0件' + (warns ? ' / 警告' + warns + '件(目視確認してください)' : ''));
