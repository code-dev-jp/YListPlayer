# Architecture（現状）

コード（src/）を読んだ結果としての現状構成。

## システム構成
ブラウザのみで完結する SPA。Vite でビルドし、データはブラウザの IndexedDB
（Dexie）に永続化する。動画再生は YouTube IFrame API 経由。

```
index.html → main.tsx → components/App.tsx
                         ├── components/Sidebar.tsx      （デスクトップ: 右20% / モバイル: プレイヤー直下）
                         ├── components/PlayerSection.tsx（デスクトップ: 左80% / モバイル: 最上部）
                         └── utils/db.ts                 （Dexie/IndexedDB）
```

モバイル画面（`< 900px`）ではレスポンシブ表示（`isMobile`）となり、
上から「動画再生エリア → 再生区間の作成 → 保存済み区間の編集 → プレイリスト選択・動画追加・動画一覧」の順に並びます。
モバイルでは「編集」チェックは初期オフで、区間再生ボタンを常に表示する。オンにするとPCと共通の区間作成・境界調整・削除操作が表示される。切り替えても未保存の開始・終了位置は保持する。ファイル/URLエクスポート・拡張機能ダウンロードセクションは非表示です。

動画領域は初期状態でデスクトップの残りの高さを使い、モバイルでは16:9を基本とする。
`ResizableVideoFrame` が動画下のつまみ・上下キー・ボタンで高さを変更する。
Pointer Eventsのキャプチャでドラッグを追跡し、最小PC240px/モバイル200pxから画面の高さまでに制限する。
高さはコンポーネント内だけに保持し、DBには保存しない。「自動」で初期レイアウトへ戻る。
保存済み区間の外枠は150pxを最小高さとし、動画の高さを手動調整した場合は残りの高さまで広がる。
モバイルの手動調整時も画面高から外側余白24pxを除いた高さを確保し、余白があれば一覧へ割り当てる。
動画が自動サイズの場合は150pxの枠とし、見出しを残して一覧部分だけ縦スクロールする。
区間作成欄はタイトル横に「区間外で停止」を置き、広い画面では開始点・終了点・保存を一行に配置する。
空の保存通知には高さを確保せず、狭い画面では操作を縦に並べる。

## ブラウザ拡張機能連携

`extension/background.js` はバックエンドサーバーを必要とせず完全クライアントサイドで動作する。
動画追加時は設定された YListPlayer URL に URL クエリパラメータ（`addVideoId`, `title`, `thumbnail`, `playlistId`）を付与してタブを開く（既存タブがある場合はそのタブの URL を更新して前面に移動する）。YListPlayer 画面（`src/components/App.tsx`）は起動時/表示時に URL パラメータを検知して IndexedDB に動画を登録し、結果を画面にトースト表示した上で URL パラメータを自動消去する。
プレイリスト一覧取得は、開いている YListPlayer タブの IndexedDB から `chrome.scripting.executeScript` 経由で取得する。

## コンポーネント
- **components/App.tsx**: アプリ全体の状態（activePlaylistId / activeVideoId / isAutoPlaying）を
  保持し、Sidebar と PlayerSection を組み合わせる。連続再生の「次へ」ロジックを持つ。
- **components/Sidebar.tsx**: プレイリストの作成・選択、動画の追加/削除/並び替え(dnd-kit)、
  Export/Import を担当。
- **components/PlayerSection.tsx**: YouTube IFrame APIの `YT.Player` を直接生成・管理し、
  セグメントの設定・保存・範囲外スキップ再生を担当。
- **components/SegmentBoundaryControls.tsx**: 開始・終了位置ごとの時刻、±1秒、現在位置への設定を表示。
  検証・保存・シークはPlayerSectionが既存ロジックで行う。
- **utils/db.ts**: Dexieスキーマ定義（Playlist / Video / VideoSegment）と `db` インスタンス。
- **utils/playback.ts**: 連続再生の次インデックス計算（`getNextVideoIndex`）と
  区間監視の判定（`resolveSegmentAction`）を持つ純粋ロジック。
  PlayerSection/App と `playback.test.ts`（vitest）の単一の真実。
- **utils/theme.ts**: MUI ダークテーマ定義。
- **loadYoutubeApi.ts**: YouTube IFrame API のロード（PlayerSection内にも同様のコードが
  重複して存在）。

## データフロー
1. 起動時、`useLiveQuery` で IndexedDB からプレイリスト・動画を購読。
2. 動画URL入力 → 正規表現で videoId 抽出 → `db.videos.add`（タイトル・サムネイルを生成）。
3. 動画選択 → `PlayerSection` が `YT.Player` を生成。準備完了後に編集操作を有効化する。
4. 500ms間隔のポーリングで現在時刻を監視。`savedSegments` 外なら次のセグメント開始へ
   `seekTo`。最後のセグメント終了なら `onVideoEnd`。
5. `onVideoEnd` が `App` に通知 → 連続再生なら次動画へ。

## API
- 外部 API: YouTube IFrame API / Player API（`https://www.youtube.com/iframe_api`）。
- アプリ自体の REST API は存在しない（純ブラウザアプリ）。

## データベース（IndexedDB / Dexie）
テーブル `YListPlayerDB` version 1:

```
playlists: '++id, name, createdAt'
videos:    '++id, playlistId, order'
```

- Video フィールド: youtubeUrl, title, thumbnail, order,
  startMarker?, endMarker?, savedSegments[]（{start,end} の配列）

## 外部サービス
- YouTube（動画取得・プレイヤー）
- img.youtube.com（サムネイル）

## 技術選定（現状）
| 項目 | 現状 | 備考 |
|---|---|---|
| 言語 | TypeScript (strict) | |
| フレームワーク | React 18 + Vite 5 | |
| UI | MUI v7 (emotion) | |
| DB | Dexie 4 (IndexedDB) | |
| DnD | @dnd-kit | |
| 動画再生 | YT IFrame API（PlayerSectionで直接生成） | |
| テスト | Vitest（5つのユーティリティテストファイル）とブラウザ回帰チェック | `tests/segment-editor.browser.mjs`、YouTube APIのみ代替 |
| Lint | ESLint（flat config） | `eslint.config.js` |

## セキュリティ境界（現状の理解）
- 認証・認可: **なし**（ローカル個人用アプリ）。
- 入力検証: YouTube URL からの videoId 抽出は正規表現で行うが、それ以外の
  入力（Import の JSON など）に対する堅牢な検証は未確認。
- 信頼境界はブラウザ内のみ。外部送信は YouTube へのプレイヤー/サムネイル取得のみ。

## 未整理・不明な点（人間への確認項目）
- `loadYoutubeApi.ts` と `PlayerSection.tsx` 内の API ロードコードが重複。どちらが
  実際に効いているか/どちらを正とするか。
- `startMarker`/`endMarker` の役割を2026-11-10に実装から確認した。
  React stateは未保存の作成位置で、動画切り替え・保存完了時にクリアされる。
  DBの同名フィールドは保存時の位置を保持し、保存区間がない場合の初期シーク位置にも使う。
  `savedSegments` は保存区間であり、境界の微調整は即座にこの配列へ保存される。
  今回はこの保存形式・初期シーク判定を変更しない。
- Import 時の JSON 形式の検証が無い。壊れたデータでどのような挙動になるか未確認。
- 連続再生（Play All）時の挙動・停止条件の仕様が未確定（Inferred）。
- タイトル・サムネイルが URL から自動作成され、動画の実タイトル取得はしない。
- スキップ再生ロジックの境界値（前後0.5秒）はコード内のマジックナンバー。

## 区間編集の検証方法

`npm test -- --cache=false` でVitestを実行する。ブラウザ回帰チェックは
`tests/segment-editor.browser.mjs` 冒頭の手順に従い、Vite開発サーバーに対して実行する。
Playwrightは一時ディレクトリへ導入でき、アプリの依存関係は増やさない。
実際のReact UI・IndexedDBを使い、外部YouTube APIのみ決定的なアダプターに置き換える。
確認範囲はモバイルの編集切り替え、開始・終了設定、保存、境界調整、重複拒否、
キーボード再生、削除確認とフォーカス復帰、200%文字拡大、ドラッグ確定・タッチ中断である。
実際のYouTube配信と実機スクリーンリーダーはこのチェックの対象外。
最終結果・スクリーンショットは `docs/reviews/segment-editor.md` を参照する。
