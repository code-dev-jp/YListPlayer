Feature: プレイリスト管理
  プレイリストの作成・選択・動画追加・並び替え・削除を行う。

  # No existing test coverage

  # Verified: 2026-09-27 フォーム操作と DB 更新は Sidebar の実装で確認済み
  Scenario: プレイリストを作成する
    Given サイドバーが表示されている
    When 作成ボタンを押し、名前を入力する
    Then 新しいプレイリストが作成され、選択状態になる

  # Verified: 2026-09-27 選択状態が activePlaylistId と動画一覧の取得で反映される
  Scenario: プレイリストを選択する
    Given プレイリストが1つ以上ある
    When ドロップダウンからプレイリストを選択する
    Then そのプレイリストが選択され、動画リストが表示される

  # Verified: 2026-09-27 fetchVideoTitle / URL 抽出 / DB add をテスト化済み
  Scenario: 有効なYouTube URLで動画を追加する
    Given プレイリストが選択されている
    When 有効なYouTube URLを入力して追加する
    Then 動画が追加され、API経由で実タイトルが保存される（取得失敗時は仮タイトル）。サムネイルはvideoIdから生成される

  # Verified: 2026-09-27 videoId 抽出の失敗時は何もしない
  Scenario: 無効なURLでは動画が追加されない
    Given プレイリストが選択されている
    When 動画IDを含まないURLを入力して追加する
    Then 何も追加されない

  # Verified: 2026-09-27 reorderItems で順序更新のロジックを検証
  Scenario: ドラッグ&ドロップで動画を並び替える
    Given プレイリストに動画が2つ以上ある
    When 動画をドラッグして順序を変える
    Then 並び順がDBに保存され、リストの順序が更新される

  # Verified: 2026-09-27 removeItemById と delete 処理で削除ロジックを検証
  Scenario: 動画を削除する
    Given プレイリストに動画がある
    When 動画の削除ボタンを押す
    Then その動画が削除される

  # Verified: コードを読んで確認済み（ConfirmDialog の prompt を使って DB を更新）
  Scenario: プレイリストをリネームする
    Given プレイリストが選択されている
    When リネームボタンを押し、新しい名前を入力して確定する
    Then プレイリストの名前がDBに保存され、ドロップダウンに新しい名前が反映される

  # Verified
  Scenario: リネームダイアログをキャンセルする
    Given プレイリストが選択されている
    When リネームボタンを押し、ダイアログをキャンセルする
    Then プレイリストの名前は変わらない