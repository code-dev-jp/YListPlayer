Feature: プレイリスト管理
  プレイリストの作成・選択・動画追加・並び替え・削除を行う。

  # No existing test coverage

  # Inferred: コードを読んで推測。テストなし・未確認
  Scenario: プレイリストを作成する
    Given サイドバーが表示されている
    When 作成ボタンを押し、名前を入力する
    Then 新しいプレイリストが作成され、選択状態になる

  # Inferred
  Scenario: プレイリストを選択する
    Given プレイリストが1つ以上ある
    When ドロップダウンからプレイリストを選択する
    Then そのプレイリストが選択され、動画リストが表示される

  # Inferred
  Scenario: 有効なYouTube URLで動画を追加する
    Given プレイリストが選択されている
    When 有効なYouTube URLを入力して追加する
    Then 動画が追加され、videoIdからタイトル・サムネイルが生成される

  # Inferred
  Scenario: 無効なURLでは動画が追加されない
    Given プレイリストが選択されている
    When 動画IDを含まないURLを入力して追加する
    Then 何も追加されない

  # Inferred
  Scenario: ドラッグ&ドロップで動画を並び替える
    Given プレイリストに動画が2つ以上ある
    When 動画をドラッグして順序を変える
    Then 並び順がDBに保存され、リストの順序が更新される

  # Inferred
  Scenario: 動画を削除する
    Given プレイリストに動画がある
    When 動画の削除ボタンを押す
    Then その動画が削除される