export type PhaseType = 'idea' | 'requirements' | 'design_planning' | 'design_document';
export type UserRole = 'owner' | 'editor' | 'viewer';
export type PhaseStatus = 'in_progress' | 'completed';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner: User;
  current_phase: PhaseType;
  members: ProjectMember[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  user: User;
  role: UserRole;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_type: PhaseType;
  data: any;
  status: PhaseStatus;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  user: User;
  phase_type: PhaseType;
  content: string;
  position?: {
    line: number;
    column: number;
  };
  resolved: boolean;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  user: User;
  phase_type: PhaseType;
  action: string;
  data_before?: any;
  data_after?: any;
  created_at: string;
}

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

export interface AIAssistRequest {
  phase_type: PhaseType;
  action: string;
  input: any;
}

export interface AIAssistResponse {
  action: string;
  output: any;
  confidence: number;
  suggestions: string[];
}
