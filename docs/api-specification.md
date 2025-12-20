# API仕様書

## ベースURL

```
# Dev環境
https://api-dev.requirements-maker.example.com/v1

# Staging環境
https://api-staging.requirements-maker.example.com/v1

# Production環境
https://api.requirements-maker.example.com/v1
```

## 認証

すべてのAPIリクエストには認証トークンが必要です。

```
Authorization: Bearer <token>
```

## 共通レスポンス形式

### 成功レスポンス
```json
{
  "success": true,
  "data": { ... }
}
```

### エラーレスポンス
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーメッセージ",
    "details": { ... }
  }
}
```

## REST API

### プロジェクト管理

#### プロジェクト一覧取得
```
GET /projects
```

**クエリパラメータ**
- `page`: ページ番号（デフォルト: 1）
- `limit`: 1ページあたりの件数（デフォルト: 20）
- `sort`: ソート順（`created_at`, `updated_at`, `name`）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "プロジェクト名",
        "description": "説明",
        "owner": {
          "id": "uuid",
          "name": "オーナー名",
          "email": "owner@example.com"
        },
        "current_phase": "idea",
        "member_count": 5,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50
    }
  }
}
```

#### プロジェクト作成
```
POST /projects
```

**リクエストボディ**
```json
{
  "name": "プロジェクト名",
  "description": "説明（オプション）"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "プロジェクト名",
      "description": "説明",
      "owner_id": "uuid",
      "current_phase": "idea",
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### プロジェクト詳細取得
```
GET /projects/{project_id}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "name": "プロジェクト名",
      "description": "説明",
      "owner": { ... },
      "current_phase": "idea",
      "members": [
        {
          "user": { ... },
          "role": "owner"
        }
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### プロジェクト更新
```
PUT /projects/{project_id}
```

**リクエストボディ**
```json
{
  "name": "新しいプロジェクト名",
  "description": "新しい説明"
}
```

#### プロジェクト削除
```
DELETE /projects/{project_id}
```

**権限**: ownerのみ

### フェーズ管理

#### フェーズデータ取得
```
GET /projects/{project_id}/phases/{phase_type}
```

**パスパラメータ**
- `phase_type`: `idea` | `requirements` | `design_planning` | `design_document`

**レスポンス**
```json
{
  "success": true,
  "data": {
    "phase": {
      "id": "uuid",
      "project_id": "uuid",
      "phase_type": "idea",
      "data": { ... },
      "status": "in_progress",
      "completed_at": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

#### フェーズデータ更新
```
PUT /projects/{project_id}/phases/{phase_type}
```

**リクエストボディ**
```json
{
  "data": { ... }
}
```

**権限**: editor以上

#### フェーズ完了
```
POST /projects/{project_id}/phases/{phase_type}/complete
```

**権限**: ownerのみ

**レスポンス**
```json
{
  "success": true,
  "data": {
    "phase": { ... },
    "next_phase": "requirements",
    "validation": {
      "passed": true,
      "issues": []
    }
  }
}
```

**完了条件バリデーション**
- `idea`: AI要約が存在する
- `requirements`: 未確定事項が0件
- `design_planning`: 技術方針が確定している
- `design_document`: 設計書が生成されている

### AI支援

#### AI支援リクエスト
```
POST /projects/{project_id}/ai-assist
```

**リクエストボディ**
```json
{
  "phase_type": "idea",
  "action": "summarize",
  "input": { ... }
}
```

**アクション一覧**

| phase_type | action | 説明 |
|-----------|---------|------|
| idea | summarize | アイデアを要約・分類 |
| idea | categorize | アイデアをカテゴリ分け |
| requirements | convert | アイデアを要件に変換 |
| requirements | validate | 曖昧さ・抜け漏れをチェック |
| design_planning | consistency_check | 要件との整合性チェック |
| design_document | generate | 設計書を自動生成 |

**レスポンス**
```json
{
  "success": true,
  "data": {
    "result": {
      "action": "summarize",
      "output": { ... },
      "confidence": 0.95,
      "suggestions": [...]
    },
    "usage": {
      "tokens": 1500
    }
  }
}
```

### コメント・レビュー

#### コメント一覧取得
```
GET /projects/{project_id}/comments
```

**クエリパラメータ**
- `phase_type`: フィルター（オプション）
- `resolved`: true/false（オプション）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "uuid",
        "user": { ... },
        "phase_type": "idea",
        "content": "コメント内容",
        "position": {
          "line": 10,
          "column": 5
        },
        "resolved": false,
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### コメント追加
```
POST /projects/{project_id}/comments
```

**リクエストボディ**
```json
{
  "phase_type": "idea",
  "content": "コメント内容",
  "position": {
    "line": 10,
    "column": 5
  }
}
```

#### コメント解決
```
PUT /projects/{project_id}/comments/{comment_id}/resolve
```

### メンバー管理

#### メンバー一覧
```
GET /projects/{project_id}/members
```

#### メンバー追加
```
POST /projects/{project_id}/members
```

**リクエストボディ**
```json
{
  "email": "user@example.com",
  "role": "editor"
}
```

**権限**: ownerのみ

#### メンバー権限変更
```
PUT /projects/{project_id}/members/{user_id}
```

**リクエストボディ**
```json
{
  "role": "viewer"
}
```

**権限**: ownerのみ

#### メンバー削除
```
DELETE /projects/{project_id}/members/{user_id}
```

**権限**: ownerのみ

### 変更履歴・ロールバック

#### 変更履歴取得
```
GET /projects/{project_id}/history
```

**クエリパラメータ**
- `phase_type`: フィルター（オプション）
- `limit`: 取得件数（デフォルト: 50）

**レスポンス**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "user": { ... },
        "phase_type": "idea",
        "action": "update",
        "data_before": { ... },
        "data_after": { ... },
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### ロールバック
```
POST /projects/{project_id}/rollback
```

**リクエストボディ**
```json
{
  "history_id": "uuid"
}
```

**権限**: ownerまたはeditor

### エクスポート

#### 設計書エクスポート
```
POST /projects/{project_id}/export
```

**リクエストボディ**
```json
{
  "format": "markdown"
}
```

**レスポンス**
```json
{
  "success": true,
  "data": {
    "export_url": "https://s3.../export.md",
    "expires_at": "2024-01-02T00:00:00Z"
  }
}
```

## WebSocket API

### 接続

```
wss://ws.requirements-maker.example.com?token=<auth_token>&project_id=<uuid>
```

### イベント形式

**クライアント → サーバー**
```json
{
  "action": "edit",
  "data": { ... }
}
```

**サーバー → クライアント**
```json
{
  "type": "edit",
  "user": { ... },
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### イベント一覧

#### edit - 編集イベント
**送信**
```json
{
  "action": "edit",
  "data": {
    "phase_type": "idea",
    "path": "ideas.0.content",
    "operation": "insert",
    "position": 10,
    "text": "追加テキスト"
  }
}
```

**受信**
```json
{
  "type": "edit",
  "user": {
    "id": "uuid",
    "name": "ユーザー名"
  },
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### cursor - カーソル位置
**送信**
```json
{
  "action": "cursor",
  "data": {
    "phase_type": "idea",
    "position": {
      "line": 10,
      "column": 5
    }
  }
}
```

#### presence - プレゼンス更新
**送信**
```json
{
  "action": "presence",
  "data": {
    "status": "active",
    "current_phase": "idea"
  }
}
```

**受信**
```json
{
  "type": "presence",
  "users": [
    {
      "id": "uuid",
      "name": "ユーザー名",
      "status": "active",
      "current_phase": "idea",
      "cursor": { ... }
    }
  ]
}
```

#### comment - コメント追加
**送信**
```json
{
  "action": "comment",
  "data": {
    "phase_type": "idea",
    "content": "コメント",
    "position": { ... }
  }
}
```

## エラーコード

| コード | 説明 |
|--------|------|
| UNAUTHORIZED | 認証エラー |
| FORBIDDEN | 権限エラー |
| NOT_FOUND | リソースが見つからない |
| VALIDATION_ERROR | バリデーションエラー |
| PHASE_NOT_COMPLETED | フェーズ完了条件を満たしていない |
| CONCURRENT_EDIT | 競合する編集が発生 |
| AI_SERVICE_ERROR | AI APIエラー |
| INTERNAL_ERROR | 内部エラー |

## レート制限

- REST API: 1000 requests/hour/user
- WebSocket: 100 messages/minute/connection
- AI API: 50 requests/hour/project

レート制限に達した場合、HTTP 429を返します。

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "レート制限を超えました",
    "details": {
      "retry_after": 3600
    }
  }
}
```
