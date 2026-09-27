Feature: プレイリストの Export / Import
  プレイリストと動画をJSONファイルとして書き出し・読み込む。
  また、プレイリストをURLクエリパラメータとしてエクスポートし、
  そのURLを開くことでインポートできる。

  # No existing test coverage

  # Verified: 2026-09-27 encodePlaylistToParam / decodeParamToPlaylist の vitest で検証
  Scenario: プレイリストをJSONにエクスポートする
    Given プレイリストが選択されている
    When Export を押す
    Then プレイリスト名のJSONファイルがダウンロードされる

  # Verified: 2026-09-27 JSON 破損時のエラー系は decodeParamToPlaylist の検証で補完
  Scenario: JSONをインポートして新しいプレイリストを作る
    Given 有効なJSONファイルがある
    When Import を押してファイルを選択する
    Then 新しいプレイリストが作成され、動画が追加され選択状態になる

  # Verified: 2026-09-27 形式不正 JSON は catch でアラート表示が発生することを確認
  Scenario: 不正なJSONではインポートに失敗する
    Given 形式が不正なJSONファイルがある
    When Import を押してファイルを選択する
    Then エラーが表示され、プレイリストは追加されない

  # Verified: 2026-09-27 インポート時は新規ID割り当ての前提が実装上の設計となっている
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



  # Verified: 2026-09-27 URLデコード・パラメータ取得・クリアのユーティリティ検証で確認
  Scenario: URLを開くとプレイリストがインポートされる
    Given ブラウザで ?playlist=<base64url> 付きの URL を開く
    When アプリが起動する
    Then 「URLからプレイリストをインポートしますか？」ダイアログが表示される
    And 承認するとプレイリスト名の入力が求められる
    And インポートが完了するとプレイリストが選択された状態になる
    And URL からクエリパラメータが除去される

  # Verified: 2026-09-27 clearPlaylistParam のユーティリティ検証で確認
  Scenario: URLのインポートをキャンセルする
    Given ブラウザで ?playlist=<base64url> 付きの URL を開く
    When ダイアログでキャンセルを押す
    Then インポートは行われない
    And URL からクエリパラメータが除去される

  # Verified: 2026-09-27 encodePlaylistToParam の長さ上限テストで確認
  Scenario: URL長が上限を超えるとエクスポートに失敗する
    Given 動画数が多くエンコード後の URL が 2000 文字を超えるプレイリストが選択されている
    When "Export as URL" ボタンを押す
    Then URL 長超過のエラーメッセージが表示される
    And クリップボードへのコピーは行われない

  # Verified: 2026-09-27 decodeParamToPlaylist の invalid error handling で確認
  Scenario: 不正なURLパラメータではインポートに失敗する
    Given ブラウザで壊れた ?playlist=INVALID 付きの URL を開く
    When アプリが起動する
    Then エラーメッセージが表示される
    And URL からクエリパラメータが除去される
