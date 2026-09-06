# Design: video title をAPI経由で取得する

- Date: 2026-09-06
- Status: approved (user approved 2026-09-06)
- Scope: 動画追加時のタイトル決定方法のみ。既存動画の補完・再取得はしない。

## Background

現状 `src/Sidebar.tsx:131` の `handleAddVideo` はタイトルを `Video ${videoId}` で
仮置きしている。サムネイルのみ `img.youtube.com` から生成される。
`docs/bdd/playlist-management.feature:22` も「videoIdからタイトル・サムネイルが
生成される」と記述されている（Inferred）。

## Decisions (user confirmed)

- API: oEmbed系（noembed）を使う。YouTube Data API v3は使わない（キー不要を優先）。
- タイミング: 追加時のみ取得・保存。以降の再取得・既存仮タイトルの補完はしない。
- 失敗時: 追加自体は成功させ、仮タイトル `Video ${videoId}` で保存する。

## Architecture

変更は `Sidebar.tsx` のみ。新規ファイル・新規依存なし。
取得ヘルパーは同ファイル内の小さな `async` 関数に閉じる（約10行）。

採用エンドポイント（キー不要・CORS対応）:

```
GET https://noembed.com/embed?url=https://www.youtube.com/watch?v={videoId}
→ { "title": "...", ... }
```

Skipped: YouTube公式oEmbed直叩き（ブラウザCORSが不安定という報告あり）、
ハイブリッド（公式→noembedの順試行、コード倍増のためYAGNIで見送り）。
Add when: noembedの可用性・精度が問題になったら。

## Data flow

1. URL入力 → 既存正規表現で `videoId` 抽出（変更なし）。
2. `fetch(noembed URL, { signal: AbortSignal.timeout(5000) })` でタイトル取得。
3. レスポンスOKかつ `title` が非空文字列なら採用、 else `Video ${videoId}`。
4. 従来通り `db.videos.add({ title, thumbnail, ... })`。サムネイル生成は変更なし。

## Error handling

- 非OKステータス・JSON不正・`title`空・タイムアウト・オフラインは全てcatchして
  仮タイトルにフォールバックする。
- 追加フローは止めない。エラー通知（alert/snackbar）は出さない。
- 非公開・削除済み動画も仮タイトルで追加される（仕様として許容）。

## Testing / Verification

- `npm run build`（tsc + vite）と `npm run lint` が成功すること。
- 手動確認: 正常URL→実タイトルで保存、無効ID→仮タイトルで保存、
  オフライン→仮タイトルで保存。
- BDD: `docs/bdd/playlist-management.feature:22` を「API経由で実タイトル取得、
  失敗時は仮タイトル」に更新する（Inferredのまま。Verified化はテスト追加時）。

## Self-review (2026-09-06)

- Placeholder: なし（エンドポイント・フォールバック・検証手順すべて具体化済み）。
- Consistency: 「追加時のみ」と「既存補完なし」が全体で一致。通知なし方針も一貫。
- Scope: 動画追加フロー1箇所のみ。単一planで実装可能。
- Ambiguity: 「実タイトル」= noembedが返す `title` と明示。タイムアウト5秒を明示。
