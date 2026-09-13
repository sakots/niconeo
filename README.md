# NicoNEO bookmarklet

ニコニコ大百科のお絵カキコ編集画面で PaintBBS NEO を開き、描画結果を既存の投稿キャンバスへ戻すブックマークレットです。認証・実際の投稿は大百科の標準フォームを使うため、このコードが資格情報や投稿 API を扱うことはありません。

配布版のバージョンは [package.json](package.json) の `version` で管理します。初期値は `0.0.0` です。ここを更新してビルドすると、NEO ダイアログの表示へ反映されます。
CODEX使用。

## ビルドと導入

```sh
npm install
npm run check
npm run build
```

生成される `dist/bookmarklet.url.txt` の一行全体を、ブックマークの URL に貼り付けてください。お絵カキコ編集画面でそのブックマークを実行し、NEO 側の「投稿」を押すと絵が元のキャンバスへ反映されます。続けて元ページの「投稿」ボタンで送信してください。

### 短いローダー版

`appneo` と同じ GitHub API + jsDelivr 方式のローダーを生成できます。`sakots/niconeo` の `main` に `dist/bookmarklet.js` をコミットして公開してください。

```sh
npm run build:loader
```

`dist/bookmarklet-loader.url.txt` が生成されます。ローダーは GitHub API から `main` の最新コミット SHA を取得して `https://cdn.jsdelivr.net/gh/sakots/niconeo@<SHA>/dist/bookmarklet.js` を読み込みます。API に接続できない場合だけ、キャッシュ回避パラメータ付きの `main` を読み込みます。本体（約 4 KB）は起動時に取得するため、ブックマーク URL 自体は約 750 文字です。

NEO 本体と CSS は起動時に公式 `funige/neo` の `master` 最新コミット SHA を GitHub API から取得し、SHA 固定の jsDelivr URL で読み込みます。GitHub API または jsDelivr を利用できない場合は、`https://oekakibbs.moe/apps/neo/` の `neo.js` / `neo.css` をキャッシュ回避パラメータ付きで使います。どちらも大百科側の Content Security Policy により禁止されている環境では起動できません。

## 実装上の前提

お絵カキコの DOM は公開 API ではないため、起動時に既存ページで最も大きい表示中の `canvas` を投稿対象として検出します。NEO の「投稿」は PaintBBS プロトコルで送信せず、そのキャンバスに PNG 相当のピクセルを転記して `input` / `change` イベントを発火します。投稿ボタンは自動クリックせず、利用者が大百科ページで最終確認して送信します。

## 更新履歴

### [2026/09/13] v0.0.0

- リポジトリ生やした
