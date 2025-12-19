// Common types used across the application

export type PhaseType = 'idea' | 'requirements' | 'design_planning' | 'design_document';
export type UserRole = 'owner' | 'editor' | 'viewer';
export type PhaseStatus = 'in_progress' | 'completed';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  current_phase: PhaseType;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  created_at: Date;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_type: PhaseType;
  data: Record<string, any>;
  status: PhaseStatus;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Phase-specific data structures
export interface IdeaData {
  ideas: Array<{
    id: string;
    content: string;
    author: string;
    created_at: string;
    tags: string[];
  }>;
  ai_summary?: {
    categories: string[];
    key_points: string[];
  };
}

export interface RequirementsData {
  functional: Array<{
    id: string;
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    status: 'confirmed' | 'uncertain';
  }>;
  non_functional: Array<{
    id: string;
    category: string;
    description: string;
    metrics?: string;
  }>;
  constraints: Array<{
    id: string;
    type: string;
    description: string;
  }>;
  uncertain_items: Array<{
    id: string;
    question: string;
    context: string;
  }>;
}

export interface DesignPlanningData {
  architecture: {
    overview: string;
    components: Array<{
      name: string;
      description: string;
      responsibilities: string[];
    }>;
  };
  technology_stack: {
    frontend?: string;
    backend?: string;
    database?: string;
    infrastructure?: string;
  };
  consistency_check?: {
    issues: Array<{
      requirement_id: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
    }>;
    validated_at: string;
  };
}

export interface DesignDocumentData {
  markdown_content: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    order: number;
  }>;
  export_history?: Array<{
    exported_at: string;
    format: 'markdown' | 'pdf';
    s3_path: string;
  }>;
}

export interface Comment {
  id: string;
  project_id: string;
  user_id: string;
  phase_type: PhaseType;
  content: string;
  position?: {
    line: number;
    column: number;
  };
  resolved: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface History {
  id: string;
  project_id: string;
  user_id: string;
  phase_type: PhaseType;
  action: string;
  data_before?: Record<string, any>;
  data_after?: Record<string, any>;
  created_at: Date;
}

export interface Connection {
  connection_id: string;
  project_id: string;
  user_id: string;
  connected_at: Date;
  last_active: Date;
}

// WebSocket message types
export interface WebSocketMessage {
  action: 'edit' | 'cursor' | 'presence' | 'comment';
  data: any;
}

export interface WebSocketEvent {
  type: 'edit' | 'cursor' | 'presence' | 'comment';
  user: {
    id: string;
    name: string;
  };
  data: any;
  timestamp: string;
}

// API request/response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// AI request/response types
export interface AIAssistRequest {
  phase_type: PhaseType;
  action: string;
  input: Record<string, any>;
}

export interface AIAssistResponse {
  action: string;
  output: Record<string, any>;
  confidence: number;
  suggestions: string[];
}
