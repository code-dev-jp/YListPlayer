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

  # Inferred
  Scenario: 保存区間の終了後は動画が終了として扱われる
    Given 最後の保存区間を再生中である
    When その区間の終了に達する
    Then 動画終了として扱われ、連続再生なら次へ進む

  # Inferred
  Scenario: 保存区間を削除する
    Given 保存区間がある
    When 区間リストの削除ボタンを押す
    Then その区間が削除される