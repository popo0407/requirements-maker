import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { phaseService } from '../services/phaseService';
import { projectService } from '../services/projectService';
import { aiService } from '../services/aiService';
import { ApiResponse, PhaseType } from '../models/types';
import { extractUserIdFromAuthHeader } from '../utils/auth';

function createResponse(
  statusCode: number,
  body: ApiResponse
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Extract user ID from event (from JWT token)
 * 
 * SECURITY NOTE: This implementation requires proper JWT authentication.
 * Ensure JWT_SECRET is set in environment variables.
 */
function getUserId(event: APIGatewayProxyEvent): string {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    return extractUserIdFromAuthHeader(authHeader);
  } catch (error: any) {
    throw new Error('Unauthorized: ' + error.message);
  }
}

/**
 * Get phase data
 */
export async function getPhase(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const phaseType = event.pathParameters?.phase_type as PhaseType;
    
    if (!projectId || !phaseType) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID and phase type are required'
        }
      });
    }
    
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    const phase = await phaseService.getPhase(projectId, phaseType);
    
    if (!phase) {
      return createResponse(404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Phase not found'
        }
      });
    }
    
    return createResponse(200, {
      success: true,
      data: { phase }
    });
  } catch (error: any) {
    console.error('Error getting phase:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

/**
 * Update phase data
 */
export async function updatePhase(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const phaseType = event.pathParameters?.phase_type as PhaseType;
    const body = JSON.parse(event.body || '{}');
    
    if (!projectId || !phaseType) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID and phase type are required'
        }
      });
    }
    
    const canEdit = await projectService.canEdit(projectId, userId);
    if (!canEdit) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to edit this project'
        }
      });
    }
    
    const phase = await phaseService.updatePhase(
      projectId,
      phaseType,
      body.data,
      userId
    );
    
    return createResponse(200, {
      success: true,
      data: { phase }
    });
  } catch (error: any) {
    console.error('Error updating phase:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

/**
 * Complete phase
 */
export async function completePhase(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const phaseType = event.pathParameters?.phase_type as PhaseType;
    
    if (!projectId || !phaseType) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID and phase type are required'
        }
      });
    }
    
    const isOwner = await projectService.isOwner(projectId, userId);
    if (!isOwner) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owner can complete a phase'
        }
      });
    }
    
    const result = await phaseService.completePhase(projectId, phaseType, userId);
    
    if (!result.validation.passed) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'PHASE_NOT_COMPLETED',
          message: 'Phase completion conditions not met',
          details: result.validation
        }
      });
    }
    
    return createResponse(200, {
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error completing phase:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

/**
 * AI assistance
 */
export async function aiAssist(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const body = JSON.parse(event.body || '{}');
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }
      });
    }
    
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    const { phase_type, action, input } = body;
    
    if (!phase_type || !action) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'phase_type and action are required'
        }
      });
    }
    
    const result = await aiService.assist({
      phase_type,
      action,
      input
    });
    
    return createResponse(200, {
      success: true,
      data: {
        result,
        usage: {
          tokens: 1500 // Mock token usage
        }
      }
    });
  } catch (error: any) {
    console.error('Error in AI assist:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'AI_SERVICE_ERROR',
        message: error.message
      }
    });
  }
}

/**
 * Get phase history
 */
export async function getHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const phaseType = event.queryStringParameters?.phase_type as PhaseType | undefined;
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }
      });
    }
    
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
    }
    
    const history = await phaseService.getHistory(projectId, phaseType, limit);
    
    return createResponse(200, {
      success: true,
      data: { history }
    });
  } catch (error: any) {
    console.error('Error getting history:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}

/**
 * Rollback to previous state
 */
export async function rollback(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const body = JSON.parse(event.body || '{}');
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }
      });
    }
    
    const canEdit = await projectService.canEdit(projectId, userId);
    if (!canEdit) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to rollback'
        }
      });
    }
    
    const { history_id } = body;
    
    if (!history_id) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'history_id is required'
        }
      });
    }
    
    const phase = await phaseService.rollback(history_id, userId);
    
    return createResponse(200, {
      success: true,
      data: { phase }
    });
  } catch (error: any) {
    console.error('Error rolling back:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}
