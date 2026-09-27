Feature: ブラウザ拡張機能からの動画追加
  YouTube ページや拡張機能ポップアップから動画を追加し、登録結果は YListPlayer の画面で確認する。

  # Verified: 2026-09-27 getVideoAddParams / clearVideoAddParams と App のトースト処理で検証
  Scenario: 拡張機能から動画を追加する
    Given YListPlayer が開いていて、追加先のプレイリストがある
    When YouTube ページまたは拡張機能ポップアップから動画を送信する
    Then 拡張機能は送信受付を表示する
    And YListPlayer は登録結果をトーストで表示する

  # Verified: 2026-09-27
  Scenario: 追加先プレイリストが見つからない
    Given 送信時に指定されたプレイリストが存在しない
    When YListPlayer が動画追加を処理する
    Then 動画は追加されず、失敗理由が YListPlayer のトーストに表示される

  # Verified: 2026-09-27
  Scenario: 複数の動画追加結果を順番に確認する
    Given 複数の動画追加リクエストが届いている
    When YListPlayer が各リクエストを処理する
    Then 各リクエストの成功または失敗がトーストで順に表示される
