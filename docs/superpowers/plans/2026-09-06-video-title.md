# Video Title via API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動画追加時にnoembed経由で実タイトルを取得し、失敗時は仮タイトルで保存する。

**Architecture:** `src/Sidebar.tsx` のみ変更。新規ファイル・新規依存なし。同ファイル内に約10行の取得ヘルパーを追加し、`handleAddVideo` から呼ぶ。

**Tech Stack:** React 18 + TypeScript (strict) + Vite 5, Dexie, fetch + `AbortSignal.timeout(5000)`, noembed API.

## Global Constraints

- 変更は `src/Sidebar.tsx` のみ。新規依存を追加しない。
- YouTube Data API v3・APIキーは使わない。
- 取得タイミングは追加時のみ。既存動画の補完・再取得はしない。
- 取得失敗時は追加を止めず、仮タイトル `Video ${videoId}` で保存する。エラー通知は出さない。
- 検証は `npm run build`（tsc + vite）と `npm run lint`（eslint flat config）で行う。

---

## File Structure

- Modify: `src/Sidebar.tsx` — 取得ヘルパー `fetchVideoTitle` を追加し、`handleAddVideo` のタイトル決定部分を変更する。責務は「追加時のタイトル解決」のみ。
- Modify: `docs/bdd/playlist-management.feature:22` — 1行の記述を新挙動に合わせる（Inferredのまま）。

---

### Task 1: noembed経由のタイトル取得を `handleAddVideo` に組み込む

**Files:**
- Modify: `src/Sidebar.tsx`（ヘルパー追加 + `handleAddVideo` のタイトル行変更）

**Interfaces:**
- Consumes: 既存の `videoId` 抽出正規表現 `/(?:v=|\/)([a-zA-Z0-9_-]{11})/`（変更なし）、`db.videos.add`（変更なし）
- Produces: `fetchVideoTitle(videoId: string): Promise<string | null>` — 実タイトルまたは `null`（失敗時）。後続タスクはこれを使わない（単一利用箇所）。

- [ ] **Step 1: 取得ヘルパーを追加する**

`src/Sidebar.tsx` で、`const Sidebar: React.FC<SidebarProps> = ({` の直前に以下を挿入する：

```tsx
const fetchVideoTitle = async (videoId: string): Promise<string | null> => {
    try {
        const res = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const title = typeof data?.title === 'string' ? data.title.trim() : '';
        return title || null;
    } catch {
        return null;
    }
};
```

- [ ] **Step 2: `handleAddVideo` のタイトル決定を変更する**

`src/Sidebar.tsx` の以下の部分を：

```tsx
        const newVideo: Video = {
            playlistId: activePlaylistId,
            youtubeUrl: url,
            title: `Video ${videoId}`,
```

次の形に変える（この2行だけが差分。他の行は触らない）：

```tsx
        const title = (await fetchVideoTitle(videoId)) ?? `Video ${videoId}`;

        const newVideo: Video = {
            playlistId: activePlaylistId,
            youtubeUrl: url,
            title,
```

- [ ] **Step 3: ビルドで検証する**

Run: `npm run build`
Expected: 成功（tsc + vite build が通る）。`AbortSignal.timeout` の型エラーが出たら、その場で `AbortController` + `setTimeout` 方式に書き換える。

- [ ] **Step 4: lintで検証する**

Run: `npm run lint`
Expected: エラーなし（警告のみなら許容し、内容を記録する）。

- [ ] **Step 5: Commit**

```bash
git add src/Sidebar.tsx
git commit -m "feat: fetch video title via noembed on add with fallback"
```

---

### Task 2: BDD記述を更新し、手動確認する

**Files:**
- Modify: `docs/bdd/playlist-management.feature:22`

**Interfaces:**
- Consumes: Task 1の挙動（追加時に実タイトル、失敗時は仮タイトル）
- Produces: なし（ドキュメント更新のみ）

- [ ] **Step 1: BDDの1行を新挙動に合わせる**

`docs/bdd/playlist-management.feature` の：

```gherkin
    Then 動画が追加され、videoIdからタイトル・サムネイルが生成される
```

を次に変える：

```gherkin
    Then 動画が追加され、API経由で実タイトルが保存される（取得失敗時は仮タイトル）。サムネイルはvideoIdから生成される
```

`# Inferred` マークは付けたままにする（テスト未整備のためVerified化しない）。

- [ ] **Step 2: 手動確認する（3ケース）**

`npm run dev` で起動し、以下を確認する：

1. 正常なYouTube URLを追加 → サイドバーに実タイトルが表示される
2. 存在しないvideoId（例: `https://www.youtube.com/watch?v=AAAAAAAAAAA`）を追加 → 仮タイトル `Video AAAAAAAAAAA` で追加される
3. オフライン（DevToolsでOffline）で追加 → 仮タイトルで追加される（約5秒後にタイムアウト）

- [ ] **Step 3: 最終ビルド・lintを通す**

Run: `npm run build`
Expected: 成功

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add docs/bdd/playlist-management.feature
git commit -m "docs: update bdd for api-fetched video title"
```
