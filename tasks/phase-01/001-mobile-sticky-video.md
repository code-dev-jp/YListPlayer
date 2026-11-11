# Mobile sticky video Implementation Plan

**Goal:** 幅900px未満で動画をスクロール中も画面上端に表示する。
**Architecture:** CSS stickyを動画フレームだけへ適用する。PlayerSectionの末尾へモバイルのSidebarを渡し、動画の包含ブロックをページ全体へ延長する。スクロールしないoverflow祖先は除去する。
**Tech Stack:** React, MUI, Playwright
**Spec:** ユーザー指定「小さい画面の時、下にスクロールしても動画部分を上部にスティッキー表示する」、docs/bdd/mobile-view.feature。

## Scope
App.tsx、PlayerSection.tsx、ResizableVideoFrame.tsx、仕様文書とブラウザチェック。

## Approaches
CSS stickyを採用する。fixedは余白の同期が必要になり、スクロールごとのJS制御は不要なので採用しない。

## Review Focus
- 幅320/390/899pxでプレイリストの末尾まで固定が続く。
- 幅900px以上は既存配置を維持する。
- 動画のサイズ変更後も固定される。
- ダイアログは動画より前面へ表示する。
- 動画未選択時もプレイリストを操作できる。

## Steps
- [x] BDDを追加し、ブラウザチェックを先に追加して固定位置の失敗を確認する。
- [x] 動画だけをstickyにし、包含ブロックを延長する。仕様・構成の説明を更新する。
- [x] stickyチェック、既存ブラウザチェック、npm test、npm run build、npm run lintを実行する。
- [x] 独立レビューを依頼し、結果と完了状況を記録する。

## Status
Complete

## Verification
- 変更前: 320pxで動画の上端位置アサーションが失敗。
- 最大高さからのリセット: 動画がクリックを遮る失敗を確認後、下部200pxの操作領域と実測高のscroll-paddingで修正。
- stickyブラウザチェック: 320/390/899/900px、低い390x390px画面。
- 既存ブラウザ回帰: 1440/390/320/900pxすべて成功。
- npm run build、npm run lint、npm test（56件）成功。ビルドの既存バンドルサイズ警告あり。
- 独立レビュー: 最大高さで操作が隠れるP1を指摘。再現するテストのRED→GREENと既存UI回帰テストで修正確認。他の指摘なし。

## Integration
隔離ワークツリーを維持し、元のブランチへの統合は行わない。
