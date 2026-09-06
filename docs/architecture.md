# Architecture（現状）

コード（src/）を読んだ結果としての現状構成。

## システム構成
ブラウザのみで完結する SPA。Vite でビルドし、データはブラウザの IndexedDB
（Dexie）に永続化する。動画再生は YouTube IFrame API 経由。

```
index.html → main.tsx → App.tsx
                         ├── Sidebar.tsx      （左20%: プレイリスト/動画管理）
                         ├── PlayerSection.tsx（右80%: 再生・セグメント編集）
                         └── db.ts            （Dexie/IndexedDB）
```

## コンポーネント
- **App.tsx**: アプリ全体の状態（activePlaylistId / activeVideoId / isAutoPlaying）を
  保持し、Sidebar と PlayerSection を組み合わせる。連続再生の「次へ」ロジックを持つ。
- **Sidebar.tsx**: プレイリストの作成・選択、動画の追加/削除/並び替え(dnd-kit)、
  Export/Import を担当。
- **PlayerSection.tsx**: YouTubeプレイヤー（LiteYouTubeEmbed + IFrame API）を管理し、
  セグメントの設定・保存・範囲外スキップ再生を担当。
- **db.ts**: Dexieスキーマ定義（Playlist / Video / VideoSegment）と `db` インスタンス。
- **theme.ts**: MUI ダークテーマ定義。
- **loadYoutubeApi.ts**: YouTube IFrame API のロード（PlayerSection内にも同様のコードが
  重複して存在）。

## データフロー
1. 起動時、`useLiveQuery` で IndexedDB からプレイリスト・動画を購読。
2. 動画URL入力 → 正規表現で videoId 抽出 → `db.videos.add`（タイトル・サムネイルを生成）。
3. 動画選択 → `PlayerSection` が `LiteYouTubeEmbed` で iframe を生成 →
   `onIframeAdded` で `YT.Player` をアタッチ。
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
| 動画再生 | react-lite-youtube-embed + YT IFrame API | |
| テスト | なし | |
| Lint | script定義のみ / eslint設定ファイル欠落 | |

## セキュリティ境界（現状の理解）
- 認証・認可: **なし**（ローカル個人用アプリ）。
- 入力検証: YouTube URL からの videoId 抽出は正規表現で行うが、それ以外の
  入力（Import の JSON など）に対する堅牢な検証は未確認。
- 信頼境界はブラウザ内のみ。外部送信は YouTube へのプレイヤー/サムネイル取得のみ。

## 未整理・不明な点（人間への確認項目）
- `loadYoutubeApi.ts` と `PlayerSection.tsx` 内の API ロードコードが重複。どちらが
  実際に効いているか/どちらを正とするか。
- `startMarker`/`endMarker` と `savedSegments` の役割分担が曖昧（マーカーは単なる
  現在値の一時保持か、永続化の意図があるか）。
- Import 時の JSON 形式の検証が無い。壊れたデータでどのような挙動になるか未確認。
- 連続再生（Play All）時の挙動・停止条件の仕様が未確定（Inferred）。
- タイトル・サムネイルが URL から自動作成され、動画の実タイトル取得はしない。
- スキップ再生ロジックの境界値（前後0.5秒）はコード内のマジックナンバー。