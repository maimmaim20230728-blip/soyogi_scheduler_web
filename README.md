# そよぎ式スケジューラー (web公開用)

みとおしが見える、絵カードのスケジュール。
今やること・次にやること・あと何個を、絵カードで見てわかる見通しスケジュール（TEACCH系の視覚支援）。

- この repo は **Vercel 公開 + Farcaster Mini App 用(public)**
- 開発の正本は private の `soyogi_scheduler` (Play/Capacitor側)。変更はまず本体側で行い、共通ファイル(style.css / app.js / i18n.js / cards.js / tap.js / timer.js / audio.js / manifest.json / sw.js / privacy.html / icons)をこちらへ手動同期する
- 🔴 **index.html だけは同期しない**。こちらの index.html には fc:miniapp / fc:frame メタと esm.sh の SDK 読み込みがあり、Play側(www)には絶対に入れない（審査対策）。本体側で index.html を変えたら、こちらへは差分を手で移す

## ドメイン・Farcaster

- 想定ドメイン: https://soyogi-scheduler-web.vercel.app/ を仮置き。Vercelのプロジェクト名確定後、index.html と .well-known/farcaster.json のURLを一括置換
- `.well-known/farcaster.json` の **accountAssociation は未署名**。Vercel公開後にヒロさんが署名ツールで追記（既存アプリと同手順・fid 3339315）

## 開発

```
node serve.js   … http://localhost:3091
node _smoke.js  … 疑似DOMスモーク
node _check.js  … 禁句・整合チェック
```

## TODO

- Vercel へデプロイ（プロジェクト名 soyogi-scheduler-web 推奨）
- accountAssociation 署名（ヒロさん）→ Farcaster Manifest ツールで Reverify → Submit
- URL がドメイン確定で変わる場合、index.html と farcaster.json のURLを一括置換
