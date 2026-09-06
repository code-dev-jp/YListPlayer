Feature: 動画再生と連続再生
  YouTube動画の再生・一時停止、プレイリストの連続再生を行う。

  # No existing test coverage

  # Inferred: コードを読んで推測。テストなし・未確認
  Scenario: 動画を選択して再生する
    Given 動画が選択されている
    When 再生ボタンを押す
    Then 動画が再生される

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