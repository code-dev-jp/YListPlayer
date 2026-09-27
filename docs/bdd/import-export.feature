Feature: プレイリストの Export / Import
  プレイリストと動画をJSONファイルとして書き出し・読み込む。
  また、プレイリストをURLクエリパラメータとしてエクスポートし、
  そのURLを開くことでインポートできる。

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

  # --- URL Export / Import ---

  # Verified
  Scenario: プレイリストを短縮URLとしてエクスポートする
    Given プレイリストが選択されており、1本以上の動画が含まれている
    When デスクトップ画面で "URLでエクスポート (短縮)" ボタンを押す
    Then longUrl が生成され zip1.io/api により短縮URLが発行される
    And 短縮URLがクリップボードにコピーされる
    And ダイアログに短縮URLとQRコードが表示される

  # Verified
  Scenario: プレイリストを通常URLとしてエクスポートする
    Given プレイリストが選択されており、1本以上の動画が含まれている
    When デスクトップ画面で "URLでエクスポート (通常)" ボタンを押す
    Then 通常の longUrl が生成され短縮APIは呼び出されない
    And 通常の URL がクリップボードにコピーされる
    And ダイアログに通常URLとQRコードが表示される



  # Inferred
  Scenario: URLを開くとプレイリストがインポートされる
    Given ブラウザで ?playlist=<base64url> 付きの URL を開く
    When アプリが起動する
    Then 「URLからプレイリストをインポートしますか？」ダイアログが表示される
    And 承認するとプレイリスト名の入力が求められる
    And インポートが完了するとプレイリストが選択された状態になる
    And URL からクエリパラメータが除去される

  # Inferred
  Scenario: URLのインポートをキャンセルする
    Given ブラウザで ?playlist=<base64url> 付きの URL を開く
    When ダイアログでキャンセルを押す
    Then インポートは行われない
    And URL からクエリパラメータが除去される

  # Inferred
  Scenario: URL長が上限を超えるとエクスポートに失敗する
    Given 動画数が多くエンコード後の URL が 2000 文字を超えるプレイリストが選択されている
    When "Export as URL" ボタンを押す
    Then URL 長超過のエラーメッセージが表示される
    And クリップボードへのコピーは行われない

  # Inferred
  Scenario: 不正なURLパラメータではインポートに失敗する
    Given ブラウザで壊れた ?playlist=INVALID 付きの URL を開く
    When アプリが起動する
    Then エラーメッセージが表示される
    And URL からクエリパラメータが除去される
