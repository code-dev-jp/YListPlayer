Feature: セグメント編集
  動画に再生区間（開始/終了マーカー）を設定・保存し、範囲外をスキップして再生する。

  # Validation: src/utils/playback.test.ts
  # Browser flow: tests/segment-editor.browser.mjs (YouTube APIのみ代替)

  # Verified: 2026-09-27 validateSegmentInput と PlayerSection の保存処理で検証
  Scenario: 開始・終了マーカーを設定して区間を保存する
    Given 動画が選択され再生されている
    When 開始位置で「開始点をセット」、終了位置で「終了点をセット」を押し「区間を保存」を押す
    Then 区間が保存され、リストに表示される

  # Verified: 2026-09-27 validateSegmentInput により未設定時に拒否する
  Scenario: マーカー未設定では保存できない
    Given 動画が選択されている
    When 開始か終了のどちらかが未設定のまま 「区間を保存」 を押す
    Then エラーが表示され、保存されない

  # Verified: 2026-09-27 validateSegmentInput により逆順を拒否する
  Scenario: 開始が終了より後では保存できない
    Given 開始位置が終了位置より後である
    When 「区間を保存」 を押す
    Then エラーが表示され、保存されない

  # Verified: 2026-09-27 validateSegmentInput により重なりを拒否する
  Scenario: 既存区間と重なる区間は保存できない
    Given 既存の保存区間がある
    When 既存区間と重なる範囲で 「区間を保存」 を押す
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

  # Verified: 2026-11-11 ブラウザで区間の再生ボタンをEnter操作。実動画配信は未検証。
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

  # Verified: 2026-11-11 ブラウザで先頭に新規区間を保存し、IndexedDBの順序と区間番号を検証
  Scenario: 先頭より前の区間を保存すると番号が付け替わる
    Given 保存された区間 #1 がある
    When #1 より前の範囲で 「区間を保存」 を押す
    Then 新しい区間が #1 となり、従来の区間は #2 以降に付け替わる

  # Verified: 2026-11-11 ブラウザで確認・取消・最後の区間削除後のフォーカスを検証
  Scenario: 保存区間を削除する
    Given 保存区間がある
    When 区間リストの削除ボタンを押す
    And 削除確認ダイアログで「削除」を選ぶ
    Then その区間が削除される

  # Inferred: 現在位置への設定成功は実機プレイヤーで未確認。順序が逆転する変更の拒否はブラウザチェックで検証。
  Scenario: 現在位置ボタンで境界を再生位置に合わせる
    Given 動画が再生中であり、開始・終了位置の編集行がある
    When 境界の現在位置ボタンを押す
    Then そのマーカーが現在の再生位置に移動する

  # Verified: 2026-11-11 ブラウザ回帰チェックで±1秒の重複・現在位置の逆順を拒否することを検証
  Scenario: 境界の移動が他の区間をまたぐ場合は移動がブロックされる
    Given 複数の保存済み区間がある
    When ±1秒の調整または現在位置への移動が他の区間をまたぐことになる
    Then 移動はブロックされ、編集欄に閉じるまで残るエラーが表示される
    And マーカーは元の位置のまま変わらない

  # Verified: 2026-11-11 tests/segment-editor.browser.mjs（YouTube APIのみ代替）
  Scenario: キーボードだけで区間を作成し保存区間を再生する
    Given 動画のプレイヤーが準備できている
    When 名前付きの再生位置スライダーを矢印キーで動かす
    And 開始点・終了点を設定して保存する
    Then 再生区間がIndexedDBに保存される
    And フォーカスが見える区間の再生ボタンをEnterで操作できる

  # Verified: 2026-11-11 tests/segment-editor.browser.mjs（YouTube APIのみ代替）
  Scenario: 保存済み区間の境界を重ならずに調整する
    Given 近接した保存区間が複数ある
    When 区間ごとの開始・終了位置の1秒調整ボタンを操作する
    Then 調整後の境界がIndexedDBに保存される
    And 順序が逆転するか他の区間と重なる変更は拒否される

  # Verified: 2026-11-11 tests/segment-editor.browser.mjs（YouTube APIのみ代替）
  Scenario: 区間削除をキャンセルする
    Given 保存区間がある
    When 名前付きの削除ボタンを押し確認ダイアログをEscapeで閉じる
    Then 保存区間は変更されず削除ボタンにフォーカスが戻る

  # Verified: 2026-11-11 tests/segment-editor.browser.mjs
  Scenario: シークのドラッグを確定または中断する
    Given 動画のプレイヤーが準備できている
    When 再生位置をドラッグして離す
    Then ドラッグ中はシークせず確定時に一度だけシークする
    When タッチの移動中に操作がキャンセルされる
    Then プレイヤーの現在時刻の監視が再開される

  # Verified: 2026-11-11 ブラウザで区間12件の固定高さ・内部スクロール・画面高への追従を検証
  Scenario: 保存済み区間を一定の高さでスクロールする
    Given 動画に保存区間がある
    When 保存区間の数が増える
    Then 動画の高さが自動のとき保存済み区間コンポーネントの高さは150pxを維持する
    And コンポーネント内をスクロールして最後の区間を操作できる
    And 広い画面では動画が残りの高さを使い画面高に合わせて広がる

  # Verified: 2026-11-11 ブラウザで高さ・ボタンの横並び・チェックの配置を検証
  Scenario: 広い画面で区間作成をコンパクトに表示する
    Given 幅1440pxの画面で区間編集を表示している
    Then 「区間外で停止」は作成タイトルの横に表示される
    And 開始点・終了点の設定と「区間を保存」は同じ行に表示される
    And 未設定時の作成コンポーネントは230px以下の高さで表示される

  # Verified: 2026-11-11 実ブラウザのマウス・CDPタッチ・キー・自動復帰・一覧拡張を検証
  Scenario: 動画と作成欄の間のつまみで動画の高さを変更する
    Given 動画が選択されている
    When 動画下のつまみをマウスまたはタッチで上下にドラッグする
    Then 動画の高さが移動量に合わせて変わる
    And 上下キーと高さ変更ボタンでも調整できる
    And 最低高さはPC240px・モバイル200pxで上限は画面の高さとなる
    And 保存データは変わらない
    And PCでは動画を小さくした分、保存区間枠が画面下端まで広がる
    When 高さの「自動」を選ぶ
    Then 初期の自動レイアウトに戻る
