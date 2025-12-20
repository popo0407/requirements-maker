import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../utils/database';
import {
  Project,
  ProjectMember,
  PhaseType,
  UserRole,
  Phase,
  PhaseStatus
} from '../models/types';

export class ProjectService {
  /**
   * Get all projects for a user
   */
  async getProjects(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ projects: Project[]; total: number }> {
    const offset = (page - 1) * limit;
    
    const projects = await query<Project>(`
      SELECT DISTINCT p.* 
      FROM projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
      ORDER BY p.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);
    
    const countResult = await queryOne<{ count: number }>(`
      SELECT COUNT(DISTINCT p.id) as count
      FROM projects p
      INNER JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
    `, [userId]);
    
    return {
      projects,
      total: countResult?.count || 0
    };
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    return await queryOne<Project>(`
      SELECT * FROM projects WHERE id = $1
    `, [projectId]);
  }

  /**
   * Create a new project
   */
  async createProject(
    name: string,
    ownerId: string,
    description?: string
  ): Promise<Project> {
    return await transaction(async (client) => {
      const projectId = uuidv4();
      
      // Create project
      const projectResult = await client.query(`
        INSERT INTO projects (id, name, description, owner_id, current_phase)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [projectId, name, description, ownerId, 'idea']);
      
      const project = projectResult.rows[0];
      
      // Add owner as member
      await client.query(`
        INSERT INTO project_members (id, project_id, user_id, role)
        VALUES ($1, $2, $3, $4)
      `, [uuidv4(), projectId, ownerId, 'owner']);
      
      // Initialize all phases
      const phases: PhaseType[] = ['idea', 'requirements', 'design_planning', 'design_document'];
      for (const phaseType of phases) {
        await client.query(`
          INSERT INTO phases (id, project_id, phase_type, data, status)
          VALUES ($1, $2, $3, $4, $5)
        `, [uuidv4(), projectId, phaseType, JSON.stringify({}), 'in_progress']);
      }
      
      return project;
    });
  }

  /**
   * Update a project
   */
  async updateProject(
    projectId: string,
    updates: Partial<Pick<Project, 'name' | 'description'>>
  ): Promise<Project | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    
    if (setClauses.length === 0) {
      return await this.getProject(projectId);
    }
    
    values.push(projectId);
    
    return await queryOne<Project>(`
      UPDATE projects
      SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<boolean> {
    const result = await query(`
      DELETE FROM projects WHERE id = $1
    `, [projectId]);
    
    return true;
  }

  /**
   * Get project members
   */
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return await query<ProjectMember>(`
      SELECT pm.*, u.name, u.email
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY pm.created_at ASC
    `, [projectId]);
  }

  /**
   * Add member to project
   */
  async addMember(
    projectId: string,
    userId: string,
    role: UserRole
  ): Promise<ProjectMember> {
    const memberId = uuidv4();
    
    const result = await query<ProjectMember>(`
      INSERT INTO project_members (id, project_id, user_id, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [memberId, projectId, userId, role]);
    
    return result[0];
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    projectId: string,
    userId: string,
    role: UserRole
  ): Promise<ProjectMember | null> {
    return await queryOne<ProjectMember>(`
      UPDATE project_members
      SET role = $1
      WHERE project_id = $2 AND user_id = $3
      RETURNING *
    `, [role, projectId, userId]);
  }

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, userId: string): Promise<boolean> {
    await query(`
      DELETE FROM project_members
      WHERE project_id = $1 AND user_id = $2
    `, [projectId, userId]);
    
    return true;
  }

  /**
   * Check if user has access to project
   */
  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    const member = await queryOne<ProjectMember>(`
      SELECT * FROM project_members
      WHERE project_id = $1 AND user_id = $2
    `, [projectId, userId]);
    
    return member !== null;
  }

  /**
   * Get user role in project
   */
  async getUserRole(projectId: string, userId: string): Promise<UserRole | null> {
    const member = await queryOne<ProjectMember>(`
      SELECT role FROM project_members
      WHERE project_id = $1 AND user_id = $2
    `, [projectId, userId]);
    
    return member?.role || null;
  }

  /**
   * Check if user can edit project
   */
  async canEdit(projectId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(projectId, userId);
    return role === 'owner' || role === 'editor';
  }

  /**
   * Check if user is owner
   */
  async isOwner(projectId: string, userId: string): Promise<boolean> {
    const role = await this.getUserRole(projectId, userId);
    return role === 'owner';
  }

  /**
   * Update current phase
   */
  async updateCurrentPhase(
    projectId: string,
    phaseType: PhaseType
  ): Promise<Project | null> {
    return await queryOne<Project>(`
      UPDATE projects
      SET current_phase = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [phaseType, projectId]);
  }
}

export const projectService = new ProjectService();
