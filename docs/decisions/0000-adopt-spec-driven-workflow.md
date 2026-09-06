# ADR-0000: Adopt SPEC/BDD/Phase-driven documentation workflow

## Context
既存コードベース（YListPlayer）に対し、OpenCode + Superpowersを用いた
SPEC駆動・BDD・Phase分割の開発ワークフローを導入することにした。
リポジトリは git 未管理・テスト未整備の状態だった。

## Decision
project-adoption skillを用いて SPEC.md / docs/architecture.md / docs/bdd/*.feature /
plans/ / tasks/ / AGENTS.md を整備し、以降の変更は feature-change skill に従う。
リポジトリを git init し、ベースラインを記録した（commit: aba223d）。

## Alternatives
- ドキュメント整備をせず、その都度コードを読んで対応する
- 既存のまま（ドキュメントなし・gitなし・テストなし）で開発を続ける

## Reason
小規模だが既に機能が複数あるため、実装を正として棚卸しし、以後の変更を
追跡可能にするため。

## Consequences
- 初回整備コストが発生する
- 全機能のBDDは現状「Inferred（推測）」段階であり、継続的な確認が必要
- テストが存在しないため、Inferredシナリオの裏付けが将来必要