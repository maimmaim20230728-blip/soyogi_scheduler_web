'use strict';
/* そよぎ式スケジューラー カード定義(絵文字カタログ + テンプレート)
   ・カードは「絵文字 + 短い言葉」の二重表示が必須(絵文字のみモードは作らない)。
     ラベルは i18n の card.<id> と1:1(言語非依存のidで保存)
   ・カテゴリは並べ替え用のタブ。ラベルは i18n の cat.<id>
   ・テンプレートは「あさのしたく」等のよく使う並び。タイトルは i18n の tpl.<id>
   ・語彙・カテゴリは現場専門家(ヒロさん)の監修前のたたき台。追加/差し替え前提
   ・成人の生活文脈で選定(幼い語や絵柄は入れない=13歳以上方針)
   ・🔴宗教/法/文化に中立(2026-07-24 調査反映): 食のタブーになる肉種・酒の絵柄は使わない/
     祈り・礼拝は quiet(しずかな じかん)に集約し特定宗教シンボルは使わない/celebrateは🎂でなく🎉/
     手の形など文化で意味が割れる絵文字は既定に使わない/家族構成やパートナー性別を描く人物イラストは避ける
   window.SCHED_CARDS = { CATEGORIES, CARDS, TEMPLATES } */
(function(){

/* カテゴリ(id/絵文字)。ラベルは i18n の cat.<id> */
var CATEGORIES = [
  { id:'groom',   emoji:'🌅' },
  { id:'meal',    emoji:'🍚' },
  { id:'health',  emoji:'💊' },
  { id:'today',   emoji:'📅' },
  { id:'outing',  emoji:'🚶' },
  { id:'day',     emoji:'🏥' },
  { id:'work',    emoji:'💼' },
  { id:'chore',   emoji:'🧹' },
  { id:'social',  emoji:'🤝' },
  { id:'money',   emoji:'👛' },
  { id:'leisure', emoji:'🌿' },
  { id:'night',   emoji:'🌙' }
];

/* カード(id/カテゴリ/絵文字)。ラベルは i18n の card.<id>。既存40idは維持(テンプレ互換) */
var CARDS = [
  /* あさ・みだしなみ */
  { id:'wake',       cat:'groom',   emoji:'⏰' },
  { id:'wash',       cat:'groom',   emoji:'🧼' },
  { id:'toilet',     cat:'groom',   emoji:'🚽' },
  { id:'brush',      cat:'groom',   emoji:'🪥' },
  { id:'dress',      cat:'groom',   emoji:'👕' },
  { id:'shave',      cat:'groom',   emoji:'🪒' },
  { id:'hair',       cat:'groom',   emoji:'💇' },
  { id:'nails',      cat:'groom',   emoji:'✂️' },
  { id:'mirror',     cat:'groom',   emoji:'🪞' },
  { id:'glasses',    cat:'groom',   emoji:'👓' },
  { id:'hearingaid', cat:'groom',   emoji:'🦻' },
  { id:'deodorant',  cat:'groom',   emoji:'🧴' },
  { id:'shower',     cat:'groom',   emoji:'🚿' },
  /* しょくじ */
  { id:'breakfast',  cat:'meal',    emoji:'🍞' },
  { id:'lunch',      cat:'meal',    emoji:'🍱' },
  { id:'dinner',     cat:'meal',    emoji:'🍲' },
  { id:'snack',      cat:'meal',    emoji:'🍵' },
  { id:'water',      cat:'meal',    emoji:'💧' },
  { id:'cook',       cat:'meal',    emoji:'🍳' },
  { id:'setmeal',    cat:'meal',    emoji:'🍴' },
  /* くすり・けんこう */
  { id:'medicine',   cat:'health',  emoji:'💊' },
  { id:'bp',         cat:'health',  emoji:'🩺' },
  { id:'temp',       cat:'health',  emoji:'🌡️' },
  { id:'medcheck',   cat:'health',  emoji:'✅' },
  { id:'medprep',    cat:'health',  emoji:'🗓️' },
  { id:'weight',     cat:'health',  emoji:'⚖️' },
  { id:'handwash',   cat:'health',  emoji:'🧼' },
  { id:'eyedrops',   cat:'health',  emoji:'👁️' },
  /* きょうのこと(見当識) */
  { id:'date',       cat:'today',   emoji:'📅' },
  { id:'weather',    cat:'today',   emoji:'☀️' },
  { id:'news',       cat:'today',   emoji:'📰' },
  /* おでかけ */
  { id:'goout',      cat:'outing',  emoji:'🚪' },
  { id:'bus',        cat:'outing',  emoji:'🚌' },
  { id:'train',      cat:'outing',  emoji:'🚃' },
  { id:'walk',       cat:'outing',  emoji:'🚶' },
  { id:'shopping',   cat:'outing',  emoji:'🛒' },
  { id:'pickup',     cat:'outing',  emoji:'🚐' },
  { id:'gohome',     cat:'outing',  emoji:'🏠' },
  { id:'car',        cat:'outing',  emoji:'🚗' },
  { id:'belongings', cat:'outing',  emoji:'🎒' },
  { id:'taxi',       cat:'outing',  emoji:'🚕' },
  { id:'bicycle',    cat:'outing',  emoji:'🚲' },
  { id:'post',       cat:'outing',  emoji:'✉️' },
  { id:'library',    cat:'outing',  emoji:'📚' },
  { id:'barber',     cat:'outing',  emoji:'💈' },
  /* つうしょ・びょういん */
  { id:'dayservice', cat:'day',     emoji:'🏢' },
  { id:'rehab',      cat:'day',     emoji:'💪' },
  { id:'exercise',   cat:'day',     emoji:'🤸' },
  { id:'hospital',   cat:'day',     emoji:'🏥' },
  { id:'meeting',    cat:'day',     emoji:'🤝' },
  /* しごと・さぎょう */
  { id:'work',       cat:'work',    emoji:'💼' },
  { id:'worktask',   cat:'work',    emoji:'🧰' },
  /* かじ */
  { id:'laundry',    cat:'chore',   emoji:'🧺' },
  { id:'clean',      cat:'chore',   emoji:'🧽' },
  { id:'trash',      cat:'chore',   emoji:'🗑️' },
  { id:'dishes',     cat:'chore',   emoji:'🍽️' },
  { id:'hanglaundry',cat:'chore',   emoji:'👔' },
  { id:'makebed',    cat:'chore',   emoji:'🛏️' },
  { id:'pet',        cat:'chore',   emoji:'🐾' },
  { id:'shoplist',   cat:'chore',   emoji:'📝' },
  { id:'mailcheck',  cat:'chore',   emoji:'📬' },
  /* ひととの やくそく */
  { id:'phone',      cat:'social',  emoji:'📞' },
  { id:'family',     cat:'social',  emoji:'👪' },
  { id:'friends',    cat:'social',  emoji:'👥' },
  { id:'visitor',    cat:'social',  emoji:'🛎️' },
  { id:'message',    cat:'social',  emoji:'💬' },
  { id:'videocall',  cat:'social',  emoji:'📱' },
  { id:'letter',     cat:'social',  emoji:'✍️' },
  /* おかね */
  { id:'wallet',     cat:'money',   emoji:'👛' },
  { id:'pay',        cat:'money',   emoji:'💴' },
  { id:'wage',       cat:'money',   emoji:'💰' },
  { id:'record',     cat:'money',   emoji:'🧾' },
  { id:'bank',       cat:'money',   emoji:'🏧' },
  /* たのしみ・きゅうけい */
  { id:'tv',         cat:'leisure', emoji:'📺' },
  { id:'music',      cat:'leisure', emoji:'🎵' },
  { id:'hobby',      cat:'leisure', emoji:'🎨' },
  { id:'rest',       cat:'leisure', emoji:'☕' },
  { id:'nap',        cat:'leisure', emoji:'😴' },
  { id:'bath',       cat:'leisure', emoji:'🛁' },
  { id:'read',       cat:'leisure', emoji:'📖' },
  { id:'games',      cat:'leisure', emoji:'🎮' },
  { id:'breath',     cat:'leisure', emoji:'🌬️' },
  { id:'quiet',      cat:'leisure', emoji:'🕯️' },
  { id:'celebrate',  cat:'leisure', emoji:'🎉' },
  { id:'sing',       cat:'leisure', emoji:'🎤' },
  { id:'puzzle',     cat:'leisure', emoji:'🧩' },
  { id:'garden',     cat:'leisure', emoji:'🌱' },
  { id:'photo',      cat:'leisure', emoji:'🖼️' },
  { id:'radio',      cat:'leisure', emoji:'📻' },
  /* よる */
  { id:'tidy',        cat:'night',  emoji:'📦' },
  { id:'pajama',      cat:'night',  emoji:'👚' },
  { id:'lightoff',    cat:'night',  emoji:'💡' },
  { id:'sleep',       cat:'night',  emoji:'🛌' },
  { id:'preptomorrow',cat:'night',  emoji:'🧳' },
  { id:'charge',      cat:'night',  emoji:'🔌' },
  { id:'lock',        cat:'night',  emoji:'🔒' },
  { id:'diary',       cat:'night',  emoji:'📔' }
];

/* テンプレート(id/カードidの並び)。タイトルは i18n の tpl.<id>
   参照するカードidは必ず CARDS に実在させる(_smoke.js が整合を検証) */
var TEMPLATES = [
  { id:'morning',  cards:['wake','wash','toilet','brush','dress','breakfast','medicine'] },
  { id:'goout',    cards:['toilet','dress','belongings','goout','bus','shopping','gohome'] },
  { id:'day',      cards:['wake','breakfast','dayservice','lunch','rehab','gohome','dinner','bath','sleep'] },
  { id:'night',    cards:['dinner','bath','brush','medicine','tidy','pajama','charge','lightoff','sleep'] },
  { id:'bath',     cards:['toilet','bath','brush','pajama','lightoff'] },
  { id:'hospital', cards:['wake','breakfast','medicine','belongings','goout','bus','hospital','pay','gohome','rest'] },
  { id:'holiday',  cards:['wake','breakfast','tv','walk','lunch','hobby','rest','dinner','bath','sleep'] }
];

window.SCHED_CARDS = { CATEGORIES: CATEGORIES, CARDS: CARDS, TEMPLATES: TEMPLATES };

})();
