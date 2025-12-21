import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PhaseType, AIAssistRequest, AIAssistResponse } from '../models/types';

/**
 * AI Service for providing phase-specific assistance using AWS Bedrock
 */
export class AIService {
  private client: BedrockRuntimeClient;
  private modelId: string;

  constructor() {
    this.client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    // Default to Claude 3 Sonnet
    this.modelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
  }

  /**
   * Request AI assistance for a specific phase
   */
  async assist(request: AIAssistRequest): Promise<AIAssistResponse> {
    const { phase_type, action, input } = request;
    
    const prompt = this.getPrompt(phase_type, action, input);
    const responseText = await this.invokeBedrock(prompt);
    
    try {
      // Try to parse JSON from the response if it's expected to be JSON
      if (action !== 'generate') {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            action,
            output: parsed,
            confidence: 0.9,
            suggestions: []
          };
        }
      }

      // Fallback for non-JSON or generate action
      return {
        action,
        output: { suggested_content: responseText },
        confidence: 0.9,
        suggestions: []
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        action,
        output: { suggested_content: responseText },
        confidence: 0.5,
        suggestions: ['AIの応答を正しく解析できませんでした。']
      };
    }
  }

  /**
   * Invoke AWS Bedrock model
   */
  private async invokeBedrock(prompt: string): Promise<string> {
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    };

    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload)
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      return responseBody.content[0].text;
    } catch (error) {
      console.error('Bedrock invocation failed:', error);
      throw new Error('AI支援機能の実行中にエラーが発生しました。');
    }
  }

  /**
   * Get AI prompts for a specific phase and action
   */
  private getPrompt(phaseType: PhaseType, action: string, input: any): string {
    const context = input.current_content || '';
    
    const basePrompts: Record<string, Record<string, string>> = {
      idea: {
        summarize: `以下のプロジェクトアイデアを要約し、主要なテーマを抽出してください。
また、Markdown形式で整理された「suggested_content」を含むJSON形式で回答してください。
JSON構造: { "summary": "...", "suggested_content": "...", "key_themes": ["...", "..."] }

入力内容:
${context}`,
        check_gaps: `以下のプロジェクトアイデアにおける「抜け漏れ」や「考慮不足」を指摘してください。
Markdown形式で追記すべき内容を「suggested_content」に含め、JSON形式で回答してください。
JSON構造: { "summary": "...", "suggested_content": "..." }

入力内容:
${context}`
      },
      requirements: {
        convert: `以下のアイデアを構造化された要件定義（機能要件・非機能要件）に変換してください。
Markdown形式の「suggested_content」を含むJSON形式で回答してください。

入力内容:
${context}`,
        validate: `以下の要件定義の曖昧さや矛盾をチェックしてください。
JSON形式で回答してください。

入力内容:
${context}`
      },
      design_planning: {
        consistency_check: `以下の設計計画と要件の整合性をチェックしてください。
JSON形式で回答してください。

入力内容:
${context}`
      },
      design_document: {
        generate: `これまでの内容に基づき、詳細な設計書をMarkdown形式で生成してください。
回答はMarkdownテキストのみで出力してください。

入力内容:
${context}`
      }
    };
    
    return basePrompts[phaseType]?.[action] || `以下の内容について支援してください: ${action}\n\n内容:\n${context}`;
  }
}

export const aiService = new AIService();
