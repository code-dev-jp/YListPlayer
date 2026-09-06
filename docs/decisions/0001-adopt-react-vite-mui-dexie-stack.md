# ADR-0001: Adopt React + Vite + MUI + Dexie stack

## Context
プレイリストとYouTube動画の再生区間をブラウザ内で管理するアプリとして
実装が始まっていた。

## Decision
React 18 + Vite 5 + TypeScript(strict) + MUI v7 + Dexie(IndexedDB) +
@dnd-kit + react-lite-youtube-embed で構成する。

## Reason
- バックエンド不要のローカル永続化 → IndexedDB/Dexie
- ダークUIのSPA → React + MUI
- YouTube再生 → IFrame API + LiteYouTubeEmbed

## Consequences
- bundle が 500kB超（Vite警告）になり、コード分割が必要になる可能性
- 外部ネットワーク（YouTube）依存