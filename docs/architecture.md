# システムアーキテクチャ

## 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                        CloudFront                            │
│                    (CDN + SSL終端)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         │                             │
    ┌────▼────┐                 ┌──────▼──────┐
    │   S3    │                 │ API Gateway │
    │(Static) │                 │ (REST+WS)   │
    └─────────┘                 └──────┬──────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │                             │
                  ┌─────▼─────┐              ┌────────▼────────┐
                  │  Lambda   │              │    Lambda       │
                  │  (REST)   │              │  (WebSocket)    │
                  └─────┬─────┘              └────────┬────────┘
                        │                             │
                        └──────────────┬──────────────┘
                                       │
                                ┌──────▼──────┐
                                │ RDS(PgSQL)  │
                                │   + S3      │
                                └─────────────┘
```

## コンポーネント詳細

### 1. フロントエンド層

#### CloudFront + S3
- **役割**: 静的コンテンツ配信、SSL/TLS終端
- **技術**: AWS CloudFront, S3
- **特徴**:
  - グローバル配信による低レイテンシ
  - S3バケットポリシーによるアクセス制御
  - キャッシュ戦略の設定

#### React Application
- **役割**: ユーザーインターフェース
- **技術**: React 18+, TypeScript, Context API
- **主要コンポーネント**:
  - PhaseNavigator: フェーズ遷移UI
  - CollaborativeEditor: リアルタイム編集エディタ
  - AIAssistant: AI支援UI
  - CommentPanel: コメント・レビュー機能
  - UserPresence: 編集中ユーザー表示

### 2. API層

#### API Gateway (REST API)
- **役割**: RESTful APIエンドポイント
- **主要エンドポイント**:
  ```
  GET    /projects                    # プロジェクト一覧
  POST   /projects                    # プロジェクト作成
  GET    /projects/{id}               # プロジェクト詳細
  PUT    /projects/{id}               # プロジェクト更新
  DELETE /projects/{id}               # プロジェクト削除
  
  GET    /projects/{id}/phases/{phase}          # フェーズデータ取得
  PUT    /projects/{id}/phases/{phase}          # フェーズデータ更新
  POST   /projects/{id}/phases/{phase}/complete # フェーズ完了
  
  POST   /projects/{id}/ai-assist     # AI支援リクエスト
  
  GET    /projects/{id}/history        # 変更履歴取得
  POST   /projects/{id}/rollback       # ロールバック実行
  
  POST   /projects/{id}/export         # 設計書エクスポート
  ```

#### API Gateway (WebSocket API)
- **役割**: リアルタイム通信
- **イベント**:
  ```
  $connect    # 接続確立
  $disconnect # 切断
  edit        # 編集イベント
  cursor      # カーソル位置
  comment     # コメント追加
  presence    # プレゼンス更新
  ```

### 3. アプリケーション層

#### Lambda Functions

**REST API Handler**
- プロジェクトCRUD操作
- フェーズデータ管理
- 権限チェック
- AI API呼び出し
- エクスポート処理

**WebSocket Handler**
- 接続管理（connectionId保存）
- メッセージブロードキャスト
- プレゼンス管理
- 編集競合解決（Operational Transformation風）

### 4. データ層

#### Amazon RDS (PostgreSQL)
- **役割**: 構造化データ永続化
- **主要テーブル**:
  - users: ユーザー情報
  - projects: プロジェクト基本情報
  - project_members: プロジェクトメンバー・権限
  - phases: フェーズごとのデータ（JSONB）
  - comments: コメント情報
  - history: 変更履歴
  - connections: WebSocket接続情報

#### Amazon S3
- **役割**: 非構造化データ保存
- **用途**:
  - エクスポートされた設計書
  - バックアップデータ
  - 添付ファイル（将来拡張）

### 5. 監視・ログ層

#### CloudWatch
- **Logs**: Lambda実行ログ、API Gatewayログ
- **Metrics**: カスタムメトリクス（同時接続数、API呼び出し数）
- **Alarms**: エラー率、レイテンシ、接続数の閾値監視

## フェーズ遷移ロジック

```
[アイデア] → (AI要約完了) → [要件定義]
           ← ロールバック可能 ←

[要件定義] → (未確定事項0件) → [設計計画]
           ←  ロールバック可能 ←

[設計計画] → (技術方針確定) → [設計書作成]
           ←  ロールバック可能 ←

[設計書作成] → (完了) → エクスポート
```

## セキュリティ

### 通信
- CloudFront経由のHTTPS通信必須
- API Gateway認証（Cognito or カスタム）
- WebSocketも同様の認証

### データ
- RDSは暗号化（at rest）
- S3バケットも暗号化
- IAMロールによる最小権限

### アクセス制御
- プロジェクト単位のアクセス制御
- ロール（Owner/Editor/Viewer）による操作制限

## スケーラビリティ

### 水平スケール
- Lambda: 自動スケール
- RDS: リードレプリカ追加可能
- WebSocket: 接続情報をDBで共有し複数Lambda間で協調

### 性能目標
- 同時接続: 10名以上
- 編集反映遅延: 1秒以内
- API応答時間: 200ms以内（P95）

## 可用性

### 目標
- SLA: 99.9%以上

### 対策
- Multi-AZ構成（RDS）
- Lambda自動リトライ
- CloudFrontキャッシュによる障害時の静的コンテンツ配信
- 日次自動バックアップ（RDS, S3）

## AI統合

### プロンプト管理
- フェーズごとに固定プロンプトをLambda環境変数で管理
- 出力スキーマを厳密に定義（JSON Schema）

### AI APIフロー
```
Client → API Gateway → Lambda → AI API (OpenAI/Anthropic等)
                              ↓
                        Schema検証
                              ↓
                        クライアントへ返却
```

### 利用者選択
- AI生成結果は必ず人が確認
- 採用/破棄のアクション記録
