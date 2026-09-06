Feature: 動画再生と連続再生
  YouTube動画の再生・一時停止、プレイリストの連続再生を行う。

  # No existing test coverage

  # Inferred: コードを読んで推測。テストなし・未確認
  Scenario: 動画を選択して再生する
    Given 動画が選択されている
    Then 埋め込みプレイヤーが直接生成され、起動クリックなしで自動再生される

  # Inferred
  Scenario: 一時停止する
    Given 動画が再生中である
    When 一時停止ボタンを押す
    Then 動画が一時停止される

  # Inferred
  Scenario: プレイリストを連続再生する
    Given プレイリストに動画が複数ある
    When Play All を押す
    Then 最初の動画が自動再生され、終了時に次へ進む

  # Inferred
  Scenario: 連続再生で最後の動画が終わると停止する
    Given 連続再生中で最後の動画を再生している
    When 動画が終了する
    Then 自動再生が停止する

  # Inferred
  Scenario: 手動で動画を選ぶと自動再生が解除される
    Given 連続再生中である
    When 別の動画を手動で選択する
    Then 自動再生が解除され、選択した動画だけが再生される

  # Inferred: 2026-09-06 埋め込み側操作の無効化対応。テストなし・未確認
  Scenario: 埋め込みプレイヤー側では操作できず自作UIに一本化される
    Given 動画が選択されている
    Then 埋め込みプレイヤーのコントロールとキーボード操作は無効で、直接クリックも自作UIに遮断される
    When 自作シークバーをドラッグする
    Then ドラッグ確定時に一度だけシークされ、ドラッグ中は定期監視による上書きが起きない

  # Verified: 2026-09-06 getNextVideoIndex としてvitestで検証
  Scenario: ループONなら最後の動画終了後に先頭から再生を再開する
    Given 連続再生中でループにチェックが入っている
    When 最後の動画が終了する
    Then リスト先頭の動画から再生が再開される

  # Verified: 2026-09-06 getNextVideoIndex としてvitestで検証（ループOFF時は従来通り停止）
  Scenario: ループOFFなら最後の動画終了後に停止する
    Given 連続再生中でループにチェックが入っていない
    When 最後の動画が終了する
    Then 自動再生が停止する

  # Inferred: 2026-09-06 自作コントロール追加。ビルドのみ確認・テストなし
  Scenario: 字幕・音量・全画面を自作UIで操作する
    Given 動画が選択されている
    Then 字幕ON・OFFボタン、音量スライダー・ミュートボタン、全画面ボタンが表示される
    When 字幕ボタンを押す
    Then 字幕モジュールの表示・非表示が切り替わる