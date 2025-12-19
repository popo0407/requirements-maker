-- Requirements Maker Database Schema
-- PostgreSQL 14+

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
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

-- Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
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

-- Create phases table
CREATE TABLE IF NOT EXISTS phases (
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

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phase_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    position JSONB,
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

-- Create history table
CREATE TABLE IF NOT EXISTS history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- Create connections table for WebSocket
CREATE TABLE IF NOT EXISTS connections (
    connection_id VARCHAR(255) PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_connections_project ON connections(project_id);
CREATE INDEX idx_connections_user ON connections(user_id);
CREATE INDEX idx_connections_last_active ON connections(last_active);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert seed data for development
-- Password: 'password' (hashed with bcrypt)
INSERT INTO users (id, email, name, password_hash) VALUES
    ('11111111-1111-1111-1111-111111111111', 'demo@example.com', 'Demo User', '$2b$10$rQZ5JZ5Z5Z5Z5Z5Z5Z5Z5.Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z')
ON CONFLICT (email) DO NOTHING;

-- Sample project
INSERT INTO projects (id, name, description, owner_id, current_phase) VALUES
    ('22222222-2222-2222-2222-222222222222', 'Sample Project', 'A sample requirements and design project', '11111111-1111-1111-1111-111111111111', 'idea')
ON CONFLICT (id) DO NOTHING;

-- Add owner as member
INSERT INTO project_members (project_id, user_id, role) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'owner')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Initialize phases for sample project
INSERT INTO phases (project_id, phase_type, data, status) VALUES
    ('22222222-2222-2222-2222-222222222222', 'idea', '{"ideas": [{"id": "1", "content": "Initial idea", "author": "11111111-1111-1111-1111-111111111111", "created_at": "2024-01-01T00:00:00Z", "tags": ["sample"]}]}', 'in_progress'),
    ('22222222-2222-2222-2222-222222222222', 'requirements', '{"functional": [], "non_functional": [], "constraints": [], "uncertain_items": []}', 'in_progress'),
    ('22222222-2222-2222-2222-222222222222', 'design_planning', '{"architecture": {}, "technology_stack": {}}', 'in_progress'),
    ('22222222-2222-2222-2222-222222222222', 'design_document', '{"markdown_content": "", "sections": []}', 'in_progress')
ON CONFLICT (project_id, phase_type) DO NOTHING;
