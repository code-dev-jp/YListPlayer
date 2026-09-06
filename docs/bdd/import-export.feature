Feature: プレイリストの Export / Import
  プレイリストと動画をJSONファイルとして書き出し・読み込む。

  # No existing test coverage

  # Inferred: コードを読んで推測。テストなし・未確認
  Scenario: プレイリストをJSONにエクスポートする
    Given プレイリストが選択されている
    When Export を押す
    Then プレイリスト名のJSONファイルがダウンロードされる

  # Inferred
  Scenario: JSONをインポートして新しいプレイリストを作る
    Given 有効なJSONファイルがある
    When Import を押してファイルを選択する
    Then 新しいプレイリストが作成され、動画が追加され選択状態になる

  # Inferred
  Scenario: 不正なJSONではインポートに失敗する
    Given 形式が不正なJSONファイルがある
    When Import を押してファイルを選択する
    Then エラーが表示され、プレイリストは追加されない

  # Inferred
  Scenario: インポート時はIDが採り直される
    Given 既存の動画IDを持つJSONをインポートする
    When インポートを実行する
    Then 新しいプレイリストID・動画IDが割り当てられる