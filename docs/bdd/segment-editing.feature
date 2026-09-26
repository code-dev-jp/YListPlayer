Feature: セグメント編集
  動画に再生区間（開始/終了マーカー）を設定・保存し、範囲外をスキップして再生する。

  # No existing test coverage

  # Inferred: コードを読んで推測。テストなし・未確認
  Scenario: 開始・終了マーカーを設定して区間を保存する
    Given 動画が選択され再生されている
    When 開始位置で Set Start、終了位置で Set Stop を押し Save Segment を押す
    Then 区間が保存され、リストに表示される

  # Inferred
  Scenario: マーカー未設定では保存できない
    Given 動画が選択されている
    When 開始か終了のどちらかが未設定のまま Save Segment を押す
    Then エラーが表示され、保存されない

  # Inferred
  Scenario: 開始が終了より後では保存できない
    Given 開始位置が終了位置より後である
    When Save Segment を押す
    Then エラーが表示され、保存されない

  # Inferred
  Scenario: 既存区間と重なる区間は保存できない
    Given 既存の保存区間がある
    When 既存区間と重なる範囲で Save Segment を押す
    Then エラーが表示され、保存されない

  # Inferred
  Scenario: 区間外をスキップして再生する
    Given 保存された区間がある動画を再生中である
    When 再生が保存区間の外に進もうとする
    Then 次の区間の開始位置へスキップされる

  # Verified: 2026-09-06 resolveSegmentAction としてvitestで検証。
  # 終了通知は1回のみ＋その場でpauseし、連続再生ならApp側が次へ進める
  Scenario: 保存区間の終了後は動画が終了として扱われる
    Given 最後の保存区間を再生中である
    When その区間の終了に達する
    Then 動画終了として扱われ、連続再生なら次へ進む
    And 手動選択時はその場で停止する

  # Inferred: 2026-09-06 区間チップのクリック再生追加。ビルドのみ確認・テストなし
  Scenario: 保存区間をクリックしてその部分から再生する
    Given 保存区間がある
    When 区間リストの区間をクリックする
    Then その区間の開始位置へシークして再生が再開される

  # Verified: 2026-09-07 resolveSegmentAction の playing 引数としてvitestで検証。
  # 一時停止中は区間外でもシークできる（#1より前へシークしても#1へ飛ばない）
  Scenario: 一時停止中は区間外のどこへでもシークできる
    Given 保存された区間がある動画を一時停止している
    When #1 より前の位置へシークする
    Then その位置に留まり、#1 へ飛ばされない

  # Inferred: 2026-09-07 保存時ソート＋表示はインデックス番号のため自動で付け替わる
  Scenario: 先頭より前の区間を保存すると番号が付け替わる
    Given 保存された区間 #1 がある
    When #1 より前の範囲で Save Segment を押す
    Then 新しい区間が #1 となり、従来の区間は #2 以降に付け替わる

  # Inferred
  Scenario: 保存区間を削除する
    Given 保存区間がある
    When 区間リストの削除ボタンを押す
    Then その区間が削除される

  # Inferred: 2026-09-27 ↯ボタン追加。ビルドのみ確認・テストなし
  Scenario: ↯ボタンでマーカーを現在の再生位置に合わせる
    Given 動画が再生中であり、シークバー上にマーカーがある
    When マーカーの ↯ ボタンを押す
    Then そのマーカーが現在の再生位置に移動する

  # Inferred: 2026-09-27 ◂/▸/↯ いずれもまたぎチェックあり。ビルドのみ確認・テストなし
  Scenario: マーカー移動（◂/▸/↯）が他の区間をまたぐ場合は移動がブロックされる
    Given 複数の保存済み区間がある
    When ◂/▸ による ±1秒 移動または ↯ による現在位置移動が他の区間をまたぐことになる
    Then 移動はブロックされ、自動で消えるトーストエラーが表示される
    And マーカーは元の位置のまま変わらない