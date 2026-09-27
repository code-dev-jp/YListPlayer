# YListPlayer

YouTube動画をプレイリストとしてまとめ、セグメント（再生区間）を指定して連続再生するブラウザアプリ。

## Features

- プレイリスト作成・管理（ドラッグ&ドロップ並び替え）
- YouTube動画の追加（URL貼り付け）
- セグメント（開始/終了マーカー）設定・スキップ再生
- 連続再生・ループ再生
- プレイリストの Export / Import (JSON)
- 字幕ON/OFF / 音量・ミュート / 全画面
- モバイル向けレスポンシブレイアウト
- IndexedDB永続化（サーバー不要）

## Tech Stack

- React 18 + TypeScript
- Vite
- MUI (Material UI)
- Dexie (IndexedDB)
- YouTube IFrame API

## Getting Started

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (default: `http://localhost:5173`).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | ビルド |
| `npm run preview` | ビルド結果をプレビュー |
| `npm run lint` | ESLint |
| `npm run test` | テスト実行 (Vitest) |
