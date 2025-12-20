import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, transaction } from '../utils/database';
import {
  Phase,
  PhaseType,
  PhaseStatus,
  History
} from '../models/types';

export class PhaseService {
  /**
   * Get phase data
   */
  async getPhase(projectId: string, phaseType: PhaseType): Promise<Phase | null> {
    return await queryOne<Phase>(`
      SELECT * FROM phases
      WHERE project_id = $1 AND phase_type = $2
    `, [projectId, phaseType]);
  }

  /**
   * Update phase data
   */
  async updatePhase(
    projectId: string,
    phaseType: PhaseType,
    data: Record<string, any>,
    userId: string
  ): Promise<Phase | null> {
    return await transaction(async (client) => {
      // Get current data for history
      const currentResult = await client.query(`
        SELECT data FROM phases
        WHERE project_id = $1 AND phase_type = $2
      `, [projectId, phaseType]);
      
      const currentData = currentResult.rows[0]?.data || {};
      
      // Update phase
      const phaseResult = await client.query(`
        UPDATE phases
        SET data = $1, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $2 AND phase_type = $3
        RETURNING *
      `, [JSON.stringify(data), projectId, phaseType]);
      
      // Record history
      await client.query(`
        INSERT INTO history (id, project_id, user_id, phase_type, action, data_before, data_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        projectId,
        userId,
        phaseType,
        'update',
        JSON.stringify(currentData),
        JSON.stringify(data)
      ]);
      
      return phaseResult.rows[0];
    });
  }

  /**
   * Complete a phase
   */
  async completePhase(
    projectId: string,
    phaseType: PhaseType,
    userId: string
  ): Promise<{ phase: Phase; nextPhase: PhaseType | null; validation: any }> {
    return await transaction(async (client) => {
      // Get phase data
      const phaseResult = await client.query(`
        SELECT * FROM phases
        WHERE project_id = $1 AND phase_type = $2
      `, [projectId, phaseType]);
      
      const phase = phaseResult.rows[0];
      if (!phase) {
        throw new Error('Phase not found');
      }
      
      // Validate completion conditions
      const validation = this.validatePhaseCompletion(phaseType, phase.data);
      
      if (!validation.passed) {
        return { phase, nextPhase: null, validation };
      }
      
      // Mark phase as completed
      const updatedResult = await client.query(`
        UPDATE phases
        SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $2 AND phase_type = $3
        RETURNING *
      `, ['completed', projectId, phaseType]);
      
      // Determine next phase
      const nextPhase = this.getNextPhase(phaseType);
      
      // Update project's current phase
      if (nextPhase) {
        await client.query(`
          UPDATE projects
          SET current_phase = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [nextPhase, projectId]);
      }
      
      // Record history
      await client.query(`
        INSERT INTO history (id, project_id, user_id, phase_type, action, data_after)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        uuidv4(),
        projectId,
        userId,
        phaseType,
        'complete',
        JSON.stringify({ completed_at: new Date().toISOString() })
      ]);
      
      return {
        phase: updatedResult.rows[0],
        nextPhase,
        validation
      };
    });
  }

  /**
   * Validate phase completion conditions
   */
  private validatePhaseCompletion(
    phaseType: PhaseType,
    data: Record<string, any>
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    switch (phaseType) {
      case 'idea':
        // Check if AI summary exists
        if (!data.ai_summary) {
          issues.push('AI要約が必要です');
        }
        break;
        
      case 'requirements':
        // Check if there are no uncertain items
        if (data.uncertain_items && data.uncertain_items.length > 0) {
          issues.push(`未確定事項が${data.uncertain_items.length}件あります`);
        }
        // Check if at least one requirement exists
        if (!data.functional || data.functional.length === 0) {
          issues.push('少なくとも1つの機能要件が必要です');
        }
        break;
        
      case 'design_planning':
        // Check if technology stack is defined
        if (!data.technology_stack || Object.keys(data.technology_stack).length === 0) {
          issues.push('技術スタックを定義してください');
        }
        // Check if architecture is defined
        if (!data.architecture || !data.architecture.overview) {
          issues.push('アーキテクチャ概要を記述してください');
        }
        break;
        
      case 'design_document':
        // Check if markdown content exists
        if (!data.markdown_content || data.markdown_content.trim().length === 0) {
          issues.push('設計書の内容を記述してください');
        }
        break;
    }
    
    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * Get next phase
   */
  private getNextPhase(currentPhase: PhaseType): PhaseType | null {
    const phaseOrder: PhaseType[] = [
      'idea',
      'requirements',
      'design_planning',
      'design_document'
    ];
    
    const currentIndex = phaseOrder.indexOf(currentPhase);
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      return phaseOrder[currentIndex + 1];
    }
    
    return null;
  }

  /**
   * Get phase history
   */
  async getHistory(
    projectId: string,
    phaseType?: PhaseType,
    limit: number = 50
  ): Promise<History[]> {
    let sql = `
      SELECT h.*, u.name as user_name, u.email as user_email
      FROM history h
      LEFT JOIN users u ON h.user_id = u.id
      WHERE h.project_id = $1
    `;
    
    const params: any[] = [projectId];
    
    if (phaseType) {
      sql += ` AND h.phase_type = $2`;
      params.push(phaseType);
    }
    
    sql += ` ORDER BY h.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    return await query<History>(sql, params);
  }

  /**
   * Rollback to a previous state
   */
  async rollback(
    historyId: string,
    userId: string
  ): Promise<Phase | null> {
    return await transaction(async (client) => {
      // Get history entry
      const historyResult = await client.query(`
        SELECT * FROM history WHERE id = $1
      `, [historyId]);
      
      const historyEntry = historyResult.rows[0];
      if (!historyEntry) {
        throw new Error('History entry not found');
      }
      
      // Restore data_before
      const phaseResult = await client.query(`
        UPDATE phases
        SET data = $1, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $2 AND phase_type = $3
        RETURNING *
      `, [
        historyEntry.data_before,
        historyEntry.project_id,
        historyEntry.phase_type
      ]);
      
      // Record rollback action
      await client.query(`
        INSERT INTO history (id, project_id, user_id, phase_type, action, data_before, data_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        uuidv4(),
        historyEntry.project_id,
        userId,
        historyEntry.phase_type,
        'rollback',
        historyEntry.data_after,
        historyEntry.data_before
      ]);
      
      return phaseResult.rows[0];
    });
  }
}

export const phaseService = new PhaseService();
