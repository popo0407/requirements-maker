import { PhaseType, AIAssistRequest, AIAssistResponse } from '../models/types';

/**
 * AI Service for providing phase-specific assistance
 * This is a stub implementation that should be replaced with actual AI API integration
 * (e.g., OpenAI, Anthropic Claude, AWS Bedrock, etc.)
 */
export class AIService {
  /**
   * Request AI assistance for a specific phase
   */
  async assist(request: AIAssistRequest): Promise<AIAssistResponse> {
    const { phase_type, action, input } = request;
    
    // This is a mock implementation
    // In production, this would call an actual AI API
    switch (phase_type) {
      case 'idea':
        return await this.handleIdeaPhase(action, input);
      
      case 'requirements':
        return await this.handleRequirementsPhase(action, input);
      
      case 'design_planning':
        return await this.handleDesignPlanningPhase(action, input);
      
      case 'design_document':
        return await this.handleDesignDocumentPhase(action, input);
      
      default:
        throw new Error(`Unknown phase type: ${phase_type}`);
    }
  }

  /**
   * Handle idea phase AI assistance
   */
  private async handleIdeaPhase(
    action: string,
    input: any
  ): Promise<AIAssistResponse> {
    switch (action) {
      case 'summarize':
        return {
          action: 'summarize',
          output: {
            summary: 'アイデアの要約: ' + (input.ideas || []).length + '件のアイデアから主要なテーマを抽出しました。',
            key_themes: ['テーマ1', 'テーマ2', 'テーマ3']
          },
          confidence: 0.85,
          suggestions: ['より詳細な説明を追加してください', '優先順位をつけることをお勧めします']
        };
      
      case 'categorize':
        return {
          action: 'categorize',
          output: {
            categories: {
              'UI/UX': [],
              'Backend': [],
              'Infrastructure': []
            }
          },
          confidence: 0.80,
          suggestions: ['カテゴリを追加または変更できます']
        };
      
      default:
        throw new Error(`Unknown action for idea phase: ${action}`);
    }
  }

  /**
   * Handle requirements phase AI assistance
   */
  private async handleRequirementsPhase(
    action: string,
    input: any
  ): Promise<AIAssistResponse> {
    switch (action) {
      case 'convert':
        return {
          action: 'convert',
          output: {
            functional_requirements: [
              {
                id: 'req-1',
                title: '変換された機能要件',
                description: 'アイデアから変換された要件',
                priority: 'high',
                status: 'confirmed'
              }
            ]
          },
          confidence: 0.75,
          suggestions: ['要件の詳細を確認してください']
        };
      
      case 'validate':
        return {
          action: 'validate',
          output: {
            issues: [
              {
                type: 'ambiguity',
                requirement_id: 'req-1',
                description: '「迅速に」という表現が曖昧です',
                suggestion: '具体的な時間を指定してください（例: 1秒以内）'
              }
            ]
          },
          confidence: 0.90,
          suggestions: ['曖昧な表現を明確にしてください']
        };
      
      default:
        throw new Error(`Unknown action for requirements phase: ${action}`);
    }
  }

  /**
   * Handle design planning phase AI assistance
   */
  private async handleDesignPlanningPhase(
    action: string,
    input: any
  ): Promise<AIAssistResponse> {
    switch (action) {
      case 'consistency_check':
        return {
          action: 'consistency_check',
          output: {
            consistent: true,
            issues: [],
            validated_at: new Date().toISOString()
          },
          confidence: 0.88,
          suggestions: ['要件とアーキテクチャの整合性が取れています']
        };
      
      default:
        throw new Error(`Unknown action for design planning phase: ${action}`);
    }
  }

  /**
   * Handle design document phase AI assistance
   */
  private async handleDesignDocumentPhase(
    action: string,
    input: any
  ): Promise<AIAssistResponse> {
    switch (action) {
      case 'generate':
        return {
          action: 'generate',
          output: {
            markdown_content: `# 設計書

## 概要
このシステムは...

## アーキテクチャ
...

## データモデル
...

## API仕様
...
`,
            sections: [
              { id: 'sec-1', title: '概要', content: 'このシステムは...', order: 1 },
              { id: 'sec-2', title: 'アーキテクチャ', content: '...', order: 2 },
              { id: 'sec-3', title: 'データモデル', content: '...', order: 3 },
              { id: 'sec-4', title: 'API仕様', content: '...', order: 4 }
            ]
          },
          confidence: 0.82,
          suggestions: ['生成された設計書を確認し、必要に応じて編集してください']
        };
      
      default:
        throw new Error(`Unknown action for design document phase: ${action}`);
    }
  }

  /**
   * Get AI prompts for a specific phase and action
   * In production, these would be managed as configuration
   */
  getPrompt(phaseType: PhaseType, action: string): string {
    const prompts: Record<string, Record<string, string>> = {
      idea: {
        summarize: 'アイデアを要約し、主要なテーマを抽出してください。出力はJSON形式で。',
        categorize: 'アイデアをカテゴリ分けしてください。出力はJSON形式で。'
      },
      requirements: {
        convert: 'アイデアを構造化された要件に変換してください。出力はJSON形式で。',
        validate: '要件の曖昧さや抜け漏れをチェックしてください。出力はJSON形式で。'
      },
      design_planning: {
        consistency_check: '設計計画と要件の整合性をチェックしてください。出力はJSON形式で。'
      },
      design_document: {
        generate: '要件と設計計画から設計書を生成してください。Markdown形式で出力。'
      }
    };
    
    return prompts[phaseType]?.[action] || '';
  }
}

export const aiService = new AIService();
