Feature: 動画再生と連続再生
  YouTube動画の再生・一時停止、プレイリストの連続再生を行う。

  # 操作UIの設計判断: docs/decisions/0003-use-youtube-native-controls.md
  # Browser: tests/playback-bdd.browser.mjs（React UI・IndexedDB、YouTube APIのみ代替）
  # API呼び出しとアプリの状態遷移を検証。実動画の自動再生・埋め込みUIは未検証。

  # Inferred: 2026-11-11 自動再生要求はブラウザで確認済み。実動画が再生されるかはブラウザの自動再生制限もあり未確認。
  Scenario: 動画を選択して再生する
    Given 動画が選択されている
    Then 埋め込みプレイヤーが直接生成され、起動クリックなしで自動再生される

  # Inferred: 2026-11-11 一時停止は埋め込みUIを使う方針をユーザー確認。実動画での停止操作は未検証。PAUSEDイベント受信時の区間外シーク抑止はブラウザで確認済み。
  Scenario: 一時停止する
    Given 動画が再生中である
    When 埋め込みプレイヤーの一時停止ボタンを押す
    Then 動画が一時停止される

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（すべて再生→3動画の選択状態遷移とAPIへの再生要求を検証）
  Scenario: プレイリストを連続再生する
    Given プレイリストに動画が複数ある
    When 「すべて再生」を押す
    Then 最初の動画が自動再生され、終了時に次へ進む

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（最終動画のENDED後に連続再生が解除されることを検証）
  Scenario: 連続再生で最後の動画が終わると停止する
    Given ループOFFの連続再生中で最後の動画を再生している
    When 動画が終了する
    Then 自動再生が停止する

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（手動選択後のENDEDで次動画へ進まないことを検証）
  Scenario: 手動で動画を選ぶと自動再生が解除される
    Given 連続再生中である
    When 別の動画を手動で選択する
    Then 自動再生が解除され、選択した動画だけが再生される

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（3動画のUI選択が末尾→先頭へ遷移）。getNextVideoIndexのVitestも検証。
  Scenario: ループONなら最後の動画終了後に先頭から再生を再開する
    Given 連続再生中でループにチェックが入っている
    When 最後の動画が終了する
    Then リスト先頭の動画から再生が再開される

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（末尾で連続再生が解除される）。getNextVideoIndexのVitestも検証。
  Scenario: ループOFFなら最後の動画終了後に停止する
    Given 連続再生中でループにチェックが入っていない
    When 最後の動画が終了する
    Then 自動再生が停止する

  # Verified: 2026-11-11 tests/playback-bdd.browser.mjs（実動画の再生成功までは保証しない）
  Scenario: 動画選択時にYouTube APIへ自動再生を要求する
    Given プレイリストの動画一覧が表示されている
    When 動画を選択する
    Then 選択した動画IDで埋め込みプレイヤーを生成する
    And autoplayを有効にし、準備完了時にplayVideoを呼ぶ
