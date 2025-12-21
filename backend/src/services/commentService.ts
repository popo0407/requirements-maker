import { query, queryOne } from '../utils/database';
import { Comment, PhaseType } from '../models/types';

export class CommentService {
  /**
   * Get comments for a project and phase
   */
  async getComments(
    projectId: string,
    phaseType?: PhaseType
  ): Promise<Comment[]> {
    let sql = `
      SELECT c.*, u.name as user_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.project_id = $1
    `;
    const params: any[] = [projectId];

    if (phaseType) {
      sql += ` AND c.phase_type = $2`;
      params.push(phaseType);
    }

    sql += ` ORDER BY c.created_at ASC`;

    return await query<Comment & { user_name: string }>(sql, params);
  }

  /**
   * Create a comment
   */
  async createComment(
    projectId: string,
    userId: string,
    phaseType: PhaseType,
    content: string,
    position?: any
  ): Promise<Comment | null> {
    return await queryOne<Comment>(`
      INSERT INTO comments (project_id, user_id, phase_type, content, position)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [projectId, userId, phaseType, content, position ? JSON.stringify(position) : null]);
  }

  /**
   * Update a comment
   */
  async updateComment(
    commentId: string,
    userId: string,
    content: string,
    resolved?: boolean
  ): Promise<Comment | null> {
    let sql = `UPDATE comments SET content = $1`;
    const params: any[] = [content];

    if (resolved !== undefined) {
      sql += `, resolved = $${params.length + 1}`;
      params.push(resolved);
    }

    sql += `, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length + 1} AND user_id = $${params.length + 2} RETURNING *`;
    params.push(commentId, userId);

    return await queryOne<Comment>(sql, params);
  }

  /**
   * Resolve a comment (can be done by anyone with access, but let's check in controller)
   */
  async resolveComment(
    commentId: string,
    resolved: boolean = true
  ): Promise<Comment | null> {
    return await queryOne<Comment>(`
      UPDATE comments
      SET resolved = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [resolved, commentId]);
  }

  /**
   * Delete a comment
   */
  async deleteComment(
    commentId: string,
    userId: string
  ): Promise<boolean> {
    const result = await query(`
      DELETE FROM comments
      WHERE id = $1 AND user_id = $2
    `, [commentId, userId]);
    
    return true; // Simplified
  }
}

export const commentService = new CommentService();
