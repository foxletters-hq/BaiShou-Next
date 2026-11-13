---
title: インストールと対応環境
description: 白守の対応プラットフォーム、ダウンロード方法、アップグレード時の注意。
---

## 対応プラットフォーム

| プラットフォーム | 状態 |
|------------------|------|
| Windows | 公式インストーラーあり |
| Android | 公式 APK あり |
| Linux | ソースから自分でビルド可能。公式の事前ビルドはありません |
| iOS / macOS | 公式クライアントは現在ありません |

ダウンロード入口は 2 つです。

- 公式サイト [foxletters.com](/) のダウンロードボタン
- GitHub Releases：https://github.com/foxletters-hq/BaiShou-Next/releases

## Windows

1. 公式サイトまたは Releases から最新のデスクトップインストーラーをダウンロードします。
2. ウィザードに従ってインストールし、起動します。
3. 未知のアプリとしてブロックされた場合は、案内に従って許可してください（実際の挙動は端末のセキュリティ方針によります）。

## Android

1. 最新の APK をダウンロードしてインストールします。
2. 「不明な提供元」と表示されたら、システム設定でその提供元を許可してから再試行します。
3. 旧 Flutter 版白守とパッケージ名が同じ場合は、上書きアップグレードできます。アップグレード後に旧データがある場合は [バージョン移行](/ja/docs/migrate/from-legacy/) を行ってください。

:::caution[ストレージ権限]
デスクトップと同じ外部ディレクトリ（`BaiShou_Root`）にデータを置きたい場合、Android では「すべてのファイルへのアクセス」のような権限が必要になることがあります。メーカー（Xiaomi、Huawei、realme など）によって設定項目の名前が違います。詳しくは [ワークスペースとデータの場所](/ja/docs/configure/workspace/) を参照してください。
:::

## バージョンについて

現行リポジトリは https://github.com/foxletters-hq/BaiShou-Next です。旧 Flutter リポジトリはメンテナンスを終了しており、新機能とリリースは BaiShou-Next でのみ行われます。

デスクトップとモバイルのバージョン番号は必ずしも同期しません（たとえば desktop 1.x と mobile 1.x はそれぞれ独立して進みます）。各端の最新 Release を基準にしてください。

インストール後は [初回起動](/ja/docs/getting-started/first-launch/) を済ませ、[10 分で話し始める](/ja/docs/getting-started/quick-start/) でモデルと RAG を入れてください。
