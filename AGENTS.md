# AGENTS.md

Superpowersを使い、SPEC・BDDに基づく開発、TDD、段階ごとの検証を行う。

（このプロジェクトは project-adoption skill により途中からこのワークフローを導入した。
既存の挙動と未確認の推測を区別し、今後の計画はSuperpowersの手順に従う。）

## 仕様ドキュメント

- `SPEC.md`: プロジェクトの目的・現在の機能・制約・開発段階
- `docs/architecture.md`: 現状構成・設計判断・未確認事項
- `docs/decisions/`: ADR
- `docs/bdd/*.feature`: 振る舞いと検証条件

計画とタスクはSuperpowersの手順に従う。保存先・タスク書式をここで固定しない。
既存の計画がある場合は参照し、保存先の移動や作り直しは行わない。

## 既存プロジェクト固有の注意
- docs/bdd/*.feature 内で `# Inferred` とマークされたシナリオは未確認。
  実装の根拠にする前に人間に確認するか、対応するテストを追加して `# Verified` に
  更新すること。
- docs/architecture.md の「未整理・不明な点」に挙げられた箇所を変更する場合は、
  着手前に必ず調査し、理解した内容をドキュメントに反映してから実装すること。
- 未文書化の領域に変更が及ぶ場合は、先にその範囲を棚卸しするサブタスクを追加すること。
- Vitestのユーティリティテストが存在する。テストの存在だけでUIや外部連携まで
  検証済みとみなさず、対象シナリオとテストの対応・確認根拠を調べること。
- 既存ドキュメントのテスト有無や技術構成の記載が実態と異なる場合は、
  コード・設定・実行結果を調査し、確認できた事実と未確認事項を区別して更新すること。

## Before implementing anything

1. SPEC/BDDに反するバグなら、Superpowers `systematic-debugging` で原因を調べる。
   挙動変更なら、設計が決定済みの場合を除き `brainstorming` で設計を整理する。
2. `SPEC.md` と `docs/architecture.md` を読む。
3. 変更対象のBDD Featureを読み、対象シナリオの `Verified` / `Inferred` と確認根拠を調べる。
   `Inferred` なら実装を再確認し、人間に確認するか、対応するテストで検証して
   `Verified` に更新してから実装の根拠にする。
4. 現在の計画・タスクがあれば、対象範囲・依存関係・完了条件を確認する。
5. 計画が必要なら、設計承認後にSuperpowers `writing-plans` を使う。
   挙動変更に対応するテスト（またはチェック）を計画に含める。
6. コードを書く前に、Superpowers `using-git-worktrees` に従い隔離された作業環境を確保する。

## While implementing

1. タスク分解はSuperpowers `writing-plans` に従う。承認済みの計画は
   `subagent-driven-development` または `executing-plans` の適用可能な手順で実行する。
2. Superpowers `test-driven-development` に従い、対象BDDシナリオから導いた失敗する
   テストを先に書き、実装する。対象の実装が壊れたときにテストが失敗することも確認する。
3. 変更のたびに `npm run build`（tsc + vite）と `npm run lint`（ESLint、flat config）を実行する。
   挙動に関わる変更では `npm test`（Vitest）も実行する。
4. 仕様・構成・BDDから実装を黙って乖離させない。乖離が必要なら、仕様変更かバグかを
   判断し、ドキュメントを先に更新するか、人間に論点を提示してから実装する。

## Before marking a task or phase complete

1. Superpowers `verification-before-completion` に従い、検証結果を確認する。
   `npm run build` と `npm run lint` が成功し、挙動に関わる変更では `npm test` も成功すること。
2. 対象BDDシナリオが満たされ、`Verified` / `Inferred` と確認根拠が最新であること。
3. Superpowers `requesting-code-review` でレビューを依頼する。
   認証・認可・外部通信・入力処理・秘密情報に関わる変更では `security-review` も使う。
4. 計画上のDefinition of Doneを満たし、現在のSuperpowers計画に進捗を反映する。
5. ブランチ内の全タスクが完了し検証できたら、Superpowers
   `finishing-a-development-branch` で統合方法を整理する。

## Rules

- ドキュメントとコードの記述を乖離させない。挙動を変えたら docs/bdd も更新する。
- 推測を「正」として SPEC/architecture に書かない。要確認事項は明記する。
- ドキュメントと実装が矛盾したら、仕様変更か実装バグかを判断し、黙って決めつけない。
- 新しい挙動のBDDシナリオは、実装前または実装と同時に追加する。
