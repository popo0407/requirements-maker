import axios, { AxiosInstance } from 'axios';
import { Project, Phase, PhaseType, Comment, HistoryEntry, AIAssistRequest, AIAssistResponse } from '../types';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Projects
  async getProjects(page: number = 1, limit: number = 20): Promise<{ projects: Project[]; total: number }> {
    const response = await this.client.get('/projects', { params: { page, limit } });
    return response.data.data;
  }

  async getProject(projectId: string): Promise<Project> {
    const response = await this.client.get(`/projects/${projectId}`);
    return response.data.data.project;
  }

  async createProject(name: string, description?: string): Promise<Project> {
    const response = await this.client.post('/projects', { name, description });
    return response.data.data.project;
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    const response = await this.client.put(`/projects/${projectId}`, updates);
    return response.data.data.project;
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.client.delete(`/projects/${projectId}`);
  }

  // Phases
  async getPhase(projectId: string, phaseType: PhaseType): Promise<Phase> {
    const response = await this.client.get(`/projects/${projectId}/phases/${phaseType}`);
    return response.data.data.phase;
  }

  async updatePhase(projectId: string, phaseType: PhaseType, data: any): Promise<Phase> {
    const response = await this.client.put(`/projects/${projectId}/phases/${phaseType}`, { data });
    return response.data.data.phase;
  }

  async completePhase(projectId: string, phaseType: PhaseType): Promise<any> {
    const response = await this.client.post(`/projects/${projectId}/phases/${phaseType}/complete`);
    return response.data.data;
  }

  // AI Assistance
  async requestAIAssist(projectId: string, request: AIAssistRequest): Promise<AIAssistResponse> {
    const response = await this.client.post(`/projects/${projectId}/ai-assist`, request);
    return response.data.data.result;
  }

  // Comments
  async getComments(projectId: string, phaseType?: PhaseType): Promise<Comment[]> {
    const params = phaseType ? { phase_type: phaseType } : {};
    const response = await this.client.get(`/projects/${projectId}/comments`, { params });
    return response.data.data;
  }

  async addComment(projectId: string, phaseType: PhaseType, content: string, position?: any): Promise<Comment> {
    const response = await this.client.post(`/projects/${projectId}/comments`, {
      phase_type: phaseType,
      content,
      position,
    });
    return response.data.data;
  }

  async resolveComment(projectId: string, commentId: string, resolved: boolean = true): Promise<Comment> {
    const response = await this.client.put(`/projects/${projectId}/comments/${commentId}`, { resolved });
    return response.data.data;
  }

  // History
  async getHistory(projectId: string, phaseType?: PhaseType, limit: number = 50): Promise<HistoryEntry[]> {
    const params = { limit, ...(phaseType && { phase_type: phaseType }) };
    const response = await this.client.get(`/projects/${projectId}/history`, { params });
    return response.data.data.history;
  }

  async rollback(projectId: string, historyId: string): Promise<Phase> {
    const response = await this.client.post(`/projects/${projectId}/rollback`, { history_id: historyId });
    return response.data.data.phase;
  }

  // Export
  async exportDesign(projectId: string, format: string = 'markdown'): Promise<string> {
    const response = await this.client.post(`/projects/${projectId}/export`, { format });
    return response.data.data.export_url;
  }

  // Database Initialization
  async initDb(): Promise<void> {
    await this.client.post('/init-db');
  }
}

const apiService = new ApiService();
export default apiService;
