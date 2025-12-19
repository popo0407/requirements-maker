# Requirements Maker - AI共同編集型 要件定義〜設計特化システム

## システム概要

Requirements Makerは、ソフトウェア開発の上流工程（アイデア整理、要件定義、設計計画、設計書作成）において、複数人がリアルタイムに共同編集しながらAIの支援を受けられる特化型システムです。

## 主な機能

### 4つのフェーズ
1. **アイデアフェーズ** - 自由形式での発想整理とAIによる要約・分類
2. **要件定義フェーズ** - 構造化された要件入力とAIによる曖昧さ・抜け漏れ指摘
3. **設計計画フェーズ** - 技術方針・構成案の整理と要件との整合性チェック
4. **設計書作成フェーズ** - 設計書自動生成と編集、外部出力

### 共通機能
- リアルタイム共同編集（WebSocket）
- AIによる各フェーズ特化支援
- コメント・レビュー機能
- 権限管理（オーナー/編集者/閲覧者）
- 変更履歴とロールバック

## 技術スタック

### Frontend
- React + TypeScript
- WebSocket (native or library like socket.io-client)
- Markdown Editor
- State Management (Context API or Redux)

### Backend
- Node.js + TypeScript
- AWS Lambda (serverless)
- API Gateway (REST + WebSocket)
- PostgreSQL (Amazon RDS)
- AWS SDK v2 (future: migrate to v3 for better performance)

### Infrastructure
- AWS CloudFormation (IaC)
- S3 + CloudFront (frontend hosting)
- CloudWatch (monitoring)

## プロジェクト構成

```
.
├── backend/              # バックエンドコード
│   └── src/
│       ├── models/       # データモデル
│       ├── controllers/  # APIコントローラー
│       ├── services/     # ビジネスロジック
│       ├── websocket/    # WebSocket ハンドラー
│       └── utils/        # ユーティリティ
├── frontend/             # フロントエンドコード
│   └── src/
│       ├── components/   # Reactコンポーネント
│       ├── pages/        # ページコンポーネント
│       ├── hooks/        # カスタムフック
│       ├── services/     # API通信
│       ├── types/        # TypeScript型定義
│       └── utils/        # ユーティリティ
├── infrastructure/       # インフラコード
│   └── cloudformation/   # CloudFormationテンプレート
└── docs/                 # ドキュメント
```

## セットアップ

### 前提条件
- Node.js 18.x以上
- AWS CLI設定済み
- PostgreSQL 14以上（ローカル開発用）

### バックエンド

```bash
cd backend
npm install
npm run build
npm test
```

### フロントエンド

```bash
cd frontend
npm install
npm start
```

### インフラデプロイ

```bash
cd infrastructure/cloudformation
# dev環境
aws cloudformation deploy --template-file main.yaml --stack-name requirements-maker-dev --parameter-overrides Environment=dev

# staging環境
aws cloudformation deploy --template-file main.yaml --stack-name requirements-maker-staging --parameter-overrides Environment=staging

# prod環境
aws cloudformation deploy --template-file main.yaml --stack-name requirements-maker-prod --parameter-overrides Environment=prod
```

## 開発ガイド

詳細なドキュメントは `docs/` ディレクトリを参照してください：

- [アーキテクチャ設計](docs/architecture.md)
- [API仕様](docs/api-specification.md)
- [データベーススキーマ](docs/database-schema.md)
- [デプロイガイド](docs/deployment-guide.md)
- [ユーザーガイド](docs/user-guide.md)

## ライセンス

MIT License