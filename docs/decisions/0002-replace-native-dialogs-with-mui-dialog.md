# ADR-0002: Replace browser native dialogs with MUI Dialog component

## Context
サイドバーでプレイリスト名の入力・削除確認・インポート失敗通知に、ブラウザネイティブの
`window.prompt()` / `window.confirm()` / `window.alert()` を使用していた。ブラウザ標準の
見た目となり、アプリのダークテーマに合わない。

## Decision
専用の `ConfirmDialog` コンポーネント（`src/ConfirmDialog.tsx`）を追加し、
MUI `Dialog` + `TextField` で3種を置き換える。呼び出し元は状態（`DialogState`）で
ダイアログを開き、閉じ時に `onResult(ok, value)` で結果を受け取る。

## Reason
- プロジェクトは既に MUI v7 を導入済みで、新規依存が不要
- ダークテーマ・フォント・ラウンド角など既存スタイルに自動で合致する
- `alert` / `confirm` / `prompt` を1コンポーネントの `variant` で統一でき、
  実装量が最少（呼び出し4箇所 + コンポーネント1ファイル）

## Consequences
- 使い方のフロー（入力→作成、確認→削除など）は不変。BDDシナリオの変更は不要
- ダイアログ開閉が Promise ではなくコールバック型になった