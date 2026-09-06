# Phase 00: ドキュメント・テストベースライン整備

## Goal
既存コードベースをSPEC/architecture/BDD/Phase/Taskの構造でドキュメント化し、
テスト・ツールチェーンの現状を確認・記録する。

## Scope
全機能（プレイリスト管理 / 動画再生・連続再生 / セグメント編集 / Import・Export）

## 現状のテスト状況
- 実行結果: テストフレームワーク未導入（0件）
- 失敗しているテスト: なし（存在しない）
- カバレッジが無い領域: 全機能
- 補足: `npm run build`（tsc + vite）は成功。`npm run lint` は eslint 設定ファイルが
  無いため現状失敗する。

## Tasks
- [x] tasks/phase-00/001.md リポジトリ棚卸し（本SkillのStep 1〜2に相当）
- [x] tasks/phase-00/002.md SPEC.md作成
- [x] tasks/phase-00/003.md architecture.md作成
- [x] tasks/phase-00/004.md docs/bdd/*.feature作成
- [x] tasks/phase-00/005.md ADR作成
- [x] tasks/phase-00/006.md AGENTS.md作成

## Definition of Done
- [x] SPEC.md / architecture.md / docs/bdd/*.feature が対象範囲について作成済み
- [x] Inferred のまま残っている項目が一覧化され、人間に共有済み
- [x] テストの現状（失敗・欠落含む）が記録済み
- [x] AGENTS.md が作成され、以降のPhaseはこのワークフローに従うことが明記されている
- [ ] （人間によるレビュー・確認が完了している）

## Status
人間レビュー待ち