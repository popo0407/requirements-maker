# デプロイガイド

## 前提条件

- AWS CLI設定済み
- AWS認証情報が設定されている
- Node.js 18.x以上
- PostgreSQL 14以上（ローカル開発用）

## 環境変数設定

### バックエンド

`.env`ファイルを作成:

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=requirements_maker
DB_USER=postgres
DB_PASSWORD=your_password

# WebSocket
WEBSOCKET_ENDPOINT=wss://your-websocket-endpoint

# JWT
JWT_SECRET=your-secret-key

# AWS
AWS_REGION=us-east-1
```

### フロントエンド

`.env`ファイルを作成:

```bash
REACT_APP_API_URL=https://api.requirements-maker.example.com/v1
REACT_APP_WS_URL=wss://ws.requirements-maker.example.com
```

## データベースセットアップ

### ローカル環境

```bash
# PostgreSQLデータベース作成
createdb requirements_maker

# パスワードハッシュを生成（開発用ユーザー）
cd backend
npm install
node scripts/generate-password-hash.js password

# 生成されたハッシュを使ってマイグレーションファイルを更新
# backend/migrations/001_initial_schema.sql の password_hash を置き換える

# マイグレーション実行
psql -d requirements_maker -f backend/migrations/001_initial_schema.sql
```

### AWS RDS

CloudFormationでRDSインスタンスが作成されます。

```bash
# RDSエンドポイントを取得
aws cloudformation describe-stacks \
  --stack-name requirements-maker-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`RDSEndpoint`].OutputValue' \
  --output text

# マイグレーション実行（踏み台サーバーまたはVPN経由）
psql -h <rds-endpoint> -U dbadmin -d requirements_maker -f backend/migrations/001_initial_schema.sql
```

## インフラデプロイ

### 1. CloudFormationスタック作成

```bash
cd infrastructure/cloudformation

# Dev環境
aws cloudformation create-stack \
  --stack-name requirements-maker-dev \
  --template-body file://main.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=dev \
    ParameterKey=DBPassword,ParameterValue=YourSecurePassword123 \
  --capabilities CAPABILITY_IAM

# Staging環境
aws cloudformation create-stack \
  --stack-name requirements-maker-staging \
  --template-body file://main.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=staging \
    ParameterKey=DBPassword,ParameterValue=YourSecurePassword123 \
  --capabilities CAPABILITY_IAM

# Production環境
aws cloudformation create-stack \
  --stack-name requirements-maker-prod \
  --template-body file://main.yaml \
  --parameters \
    ParameterKey=Environment,ParameterValue=prod \
    ParameterKey=DBInstanceClass,ParameterValue=db.t3.small \
    ParameterKey=DBPassword,ParameterValue=YourSecurePassword123 \
  --capabilities CAPABILITY_IAM
```

### 2. スタック作成の確認

```bash
# スタックステータス確認
aws cloudformation describe-stacks \
  --stack-name requirements-maker-prod \
  --query 'Stacks[0].StackStatus'

# 出力値を確認
aws cloudformation describe-stacks \
  --stack-name requirements-maker-prod \
  --query 'Stacks[0].Outputs'
```

## バックエンドデプロイ

### Lambda関数のビルド

```bash
cd backend

# 依存関係インストール
npm install

# ビルド
npm run build

# Lambda関数パッケージ作成
cd dist
zip -r ../function.zip .
cd ..
zip -r function.zip node_modules
```

### Lambda関数のデプロイ

```bash
# Lambda関数作成（初回のみ）
aws lambda create-function \
  --function-name requirements-maker-api \
  --runtime nodejs18.x \
  --role <LambdaExecutionRoleArn> \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --environment Variables="{DB_HOST=<rds-endpoint>,DB_NAME=requirements_maker,DB_USER=dbadmin,DB_PASSWORD=<password>}" \
  --vpc-config SubnetIds=<subnet-ids>,SecurityGroupIds=<security-group-ids>

# Lambda関数更新
aws lambda update-function-code \
  --function-name requirements-maker-api \
  --zip-file fileb://function.zip
```

### API Gatewayの設定

REST APIとWebSocket APIをAPI Gatewayで設定します。

```bash
# REST API作成
aws apigatewayv2 create-api \
  --name requirements-maker-api \
  --protocol-type HTTP \
  --target <lambda-arn>

# WebSocket API作成
aws apigatewayv2 create-api \
  --name requirements-maker-websocket \
  --protocol-type WEBSOCKET \
  --route-selection-expression '$request.body.action'
```

## フロントエンドデプロイ

### ビルド

```bash
cd frontend

# 依存関係インストール
npm install

# 本番ビルド
npm run build
```

### S3へデプロイ

```bash
# S3バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name requirements-maker-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
  --output text)

# ビルドしたファイルをS3にアップロード
aws s3 sync build/ s3://$BUCKET_NAME/ --delete

# CloudFrontのキャッシュを無効化
# Get distribution ID from CloudFormation outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name requirements-maker-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

## デプロイ自動化（CI/CD）

GitHub Actions等を使用した自動デプロイの例:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Deploy Backend
        run: |
          cd backend
          npm install
          npm run build
          # Lambda deployment script
      
      - name: Deploy Frontend
        run: |
          cd frontend
          npm install
          npm run build
          aws s3 sync build/ s3://${{ secrets.S3_BUCKET }}/ --delete
```

## ロールバック手順

### CloudFormation

```bash
# 前のバージョンに戻す
aws cloudformation update-stack \
  --stack-name requirements-maker-prod \
  --use-previous-template \
  --capabilities CAPABILITY_IAM
```

### Lambda

```bash
# 前のバージョンに戻す
aws lambda update-function-code \
  --function-name requirements-maker-api \
  --s3-bucket <bucket> \
  --s3-key <previous-version-key>
```

### データベース

```bash
# RDSスナップショットから復元
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier requirements-maker-prod-restored \
  --db-snapshot-identifier <snapshot-id>
```

## モニタリング

### CloudWatch

```bash
# ログ確認
aws logs tail /aws/lambda/requirements-maker-api --follow

# メトリクス確認
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=requirements-maker-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## トラブルシューティング

### Lambda関数がVPC内のRDSに接続できない

1. セキュリティグループの設定を確認
2. サブネットがプライベートサブネットであることを確認
3. NATゲートウェイの設定を確認（外部API呼び出しがある場合）

### CloudFrontが古いコンテンツを返す

```bash
# キャッシュを無効化
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

### WebSocket接続が切れる

1. API Gatewayのタイムアウト設定を確認（デフォルト: 10分）
2. Lambda関数のタイムアウト設定を確認
3. クライアント側でハートビート実装を確認
