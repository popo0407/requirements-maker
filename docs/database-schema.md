# データベーススキーマ

## ER図

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   users     │         │    projects      │         │   phases    │
├─────────────┤         ├──────────────────┤         ├─────────────┤
│ id (PK)     │         │ id (PK)          │◄────────┤ id (PK)     │
│ email       │         │ name             │         │ project_id  │
│ name        │    ┌────┤ owner_id (FK)    │         │ phase_type  │
│ created_at  │    │    │ current_phase    │         │ data (JSONB)│
└─────────────┘    │    │ created_at       │         │ status      │
       ▲           │    │ updated_at       │         │ completed_at│
       │           │    └──────────────────┘         │ created_at  │
       │           │            │                    │ updated_at  │
       │           │            │                    └─────────────┘
┌──────┴────────┐  │    ┌───────▼──────────┐
│project_members│  │    │    comments      │
├───────────────┤  │    ├──────────────────┤
│ id (PK)       │  │    │ id (PK)          │
│ project_id(FK)│──┘    │ project_id (FK)  │
│ user_id (FK)  │───────┤ user_id (FK)     │
│ role          │       │ phase_type       │
│ created_at    │       │ content          │
└───────────────┘       │ position (JSONB) │
                        │ resolved         │
                        │ created_at       │
                        └──────────────────┘
                        
┌──────────────────┐    ┌────────────────────┐
│     history      │    │    connections     │
├──────────────────┤    ├────────────────────┤
│ id (PK)          │    │ connection_id (PK) │
│ project_id (FK)  │    │ project_id (FK)    │
│ user_id (FK)     │    │ user_id (FK)       │
│ phase_type       │    │ connected_at       │
│ action           │    │ last_active        │
│ data_before(JSONB│    └────────────────────┘
│ data_after(JSONB)│
│ created_at       │
└──────────────────┘
```

## テーブル定義

### users
ユーザー情報を管理

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
```

### projects
プロジェクトの基本情報

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_phase VARCHAR(50) NOT NULL DEFAULT 'idea',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_current_phase CHECK (
        current_phase IN ('idea', 'requirements', 'design_planning', 'design_document')
    )
);

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_current_phase ON projects(current_phase);
```

### project_members
プロジェクトメンバーと権限

```sql
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_role CHECK (role IN ('owner', 'editor', 'viewer')),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### phases
各フェーズのデータ（JSONB形式で柔軟に保存）

```sql
CREATE TABLE phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_phase_type CHECK (
        phase_type IN ('idea', 'requirements', 'design_planning', 'design_document')
    ),
    CONSTRAINT chk_status CHECK (status IN ('in_progress', 'completed')),
    UNIQUE(project_id, phase_type)
);

CREATE INDEX idx_phases_project ON phases(project_id);
CREATE INDEX idx_phases_type ON phases(phase_type);
CREATE INDEX idx_phases_data ON phases USING GIN(data);
```

#### フェーズデータ構造例

**ideaフェーズ**
```json
{
  "ideas": [
    {
      "id": "uuid",
      "content": "アイデア内容",
      "author": "user_id",
      "created_at": "timestamp",
      "tags": ["tag1", "tag2"]
    }
  ],
  "ai_summary": {
    "categories": [...],
    "key_points": [...]
  }
}
```

**requirementsフェーズ**
```json
{
  "functional": [
    {
      "id": "uuid",
      "title": "機能名",
      "description": "説明",
      "priority": "high|medium|low",
      "status": "confirmed|uncertain"
    }
  ],
  "non_functional": [...],
  "constraints": [...],
  "uncertain_items": [...]
}
```

**design_planningフェーズ**
```json
{
  "architecture": {
    "overview": "...",
    "components": [...]
  },
  "technology_stack": {
    "frontend": "...",
    "backend": "...",
    "database": "..."
  },
  "consistency_check": {
    "issues": [],
    "validated_at": "timestamp"
  }
}
```

**design_documentフェーズ**
```json
{
  "markdown_content": "...",
  "sections": [
    {
      "id": "uuid",
      "title": "...",
      "content": "...",
      "order": 1
    }
  ],
  "export_history": [
    {
      "exported_at": "timestamp",
      "format": "markdown|pdf",
      "s3_path": "..."
    }
  ]
}
```

### comments
コメント・レビュー機能

```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    position JSONB,  -- テキスト位置情報
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_comment_phase CHECK (
        phase_type IN ('idea', 'requirements', 'design_planning', 'design_document')
    )
);

CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_comments_phase ON comments(phase_type);
CREATE INDEX idx_comments_resolved ON comments(resolved);
```

### history
変更履歴

```sql
CREATE TABLE history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    phase_type VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    data_before JSONB,
    data_after JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_history_phase CHECK (
        phase_type IN ('idea', 'requirements', 'design_planning', 'design_document')
    )
);

CREATE INDEX idx_history_project ON history(project_id);
CREATE INDEX idx_history_created ON history(created_at DESC);
```

### connections
WebSocket接続管理

```sql
CREATE TABLE connections (
    connection_id VARCHAR(255) PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_connections_project ON connections(project_id);
CREATE INDEX idx_connections_user ON connections(user_id);
CREATE INDEX idx_connections_last_active ON connections(last_active);
```

## マイグレーション

### 初期セットアップ
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run table creation scripts in order
-- 1. users
-- 2. projects
-- 3. project_members
-- 4. phases
-- 5. comments
-- 6. history
-- 7. connections

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## バックアップ戦略

### 自動バックアップ
- RDS自動バックアップ: 日次、保持期間7日
- ポイントインタイムリカバリ: 有効

### 手動バックアップ
```bash
# データベース全体
pg_dump -h <rds-endpoint> -U <user> -d requirements_maker > backup.sql

# 特定プロジェクト
pg_dump -h <rds-endpoint> -U <user> -d requirements_maker -t projects -t phases \
  --where="project_id='<uuid>'" > project_backup.sql
```
