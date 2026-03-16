# 🎱 ロト6自動更新ポータルサイト

GitHub Pagesで完全自動運用されるロト6情報サイトです。

## ✨ 主な機能

- **最新抽選結果**: リアルタイムカウントダウンとアニメーション表示
- **統計分析**: Chart.jsによる高度な可視化（出現頻度、間隔分析、相関）
- **当選チェッカー**: 過去データとの照合、Myセット保存
- **自動更新**: GitHub Actionsによる完全自動データ取得

## 🚀 セットアップ手順

### 1. リポジトリ作成
```bash
# リポジトリをクローンまたは作成
git clone <your-repo-url>
cd <repo-name>

# ファイル構造を確認
loto6/
├── index.html
├── pages/
├── assets/
├── scripts/
└── .github/workflows/
