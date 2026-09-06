# AGENTS.md

opencode + superpower skill を使った spec driven / test driven / BDD /
phase分割 ＋ ステップでの検証をしながら進める開発

（このプロジェクトは project-adoption skill により途中からこのワークフローを導入した。
Phase 00 はドキュメント整備そのもの。Phase 01 以降が実際の機能開発。）

## ディレクトリ構造
```
.
├── SPEC.md                  # プロジェクトの目的・現在の機能・制約
├── AGENTS.md                # 本ファイル
├── docs/
│   ├── architecture.md      # コードから逆算した現状構成・不明点
│   ├── decisions/           # ADR
│   └── bdd/                 # Gherkin シナリオ
├── plans/phase-NN.md        # Phase 計画
└── tasks/phase-NN/NNN.md    # Task 詳細
```

## 既存プロジェクト固有の注意
- docs/bdd/*.feature 内で `# Inferred` とマークされたシナリオは未確認。
  実装の根拠にする前に人間に確認するか、対応するテストを追加して `# Verified` に
  更新すること。
- docs/architecture.md の「未整理・不明な点」に挙げられた箇所を変更する場合は、
  着手前に必ず調査し、理解した内容をドキュメントに反映してから実装すること。
- 現在テストが存在しない。挙動を変える変更にはテストの追加を伴わせること。

## Before implementing anything
- 変更対象の領域の BDD Feature を読み、対象シナリオが `# Verified` か確認する。
- `Inferred` なら、まず実装を再確認し、必要なら人間に確認してから着手する。
- 現在の挙動を変える場合、対応するテスト（またはチェック）を計画に含める。

## While implementing
- 変更のたびに `npm run build`（tsc + vite）で型・ビルドの検証を行う。
- lint は現在設定が無いため、導入した場合はここに記す。

## Before marking a task or phase complete
- `npm run build` が成功すること。
- BDD シナリオの Verified/Inferred 状態が最新化されていること。
- 計画上の Definition of Done が満たされていること。

## Rules
- ドキュメントとコードの記述を乖離させない。挙動を変えたら docs/bdd も更新する。
- 推測を「正」として SPEC/architecture に書かない。要確認事項は明記する。