import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { commentService } from '../services/commentService';
import { projectService } from '../services/projectService';
import { ApiResponse, PhaseType } from '../models/types';
import { extractUserIdFromAuthHeader } from '../utils/auth';

/**
 * Create API Gateway response
 */
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
 * Extract user ID from event
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
 * List comments for a project
 */
export async function listComments(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const phaseType = event.queryStringParameters?.phase_type as PhaseType;
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Project ID is required' }
      });
    }
    
    // Check access
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }
    
    const comments = await commentService.getComments(projectId, phaseType);
    
    return createResponse(200, {
      success: true,
      data: comments
    });
  } catch (error: any) {
    console.error('Error listing comments:', error);
    return createResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
}

/**
 * Create a comment
 */
export async function createComment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    
    if (!projectId || !event.body) {
      return createResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Project ID and body are required' }
      });
    }
    
    const { phase_type, content, position } = JSON.parse(event.body);
    
    if (!phase_type || !content) {
      return createResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Phase type and content are required' }
      });
    }
    
    // Check access
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }
    
    const comment = await commentService.createComment(
      projectId,
      userId,
      phase_type,
      content,
      position
    );
    
    return createResponse(201, {
      success: true,
      data: comment
    });
  } catch (error: any) {
    console.error('Error creating comment:', error);
    return createResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
}

/**
 * Resolve a comment
 */
export async function resolveComment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    const commentId = event.pathParameters?.comment_id;
    
    if (!projectId || !commentId) {
      return createResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Project ID and Comment ID are required' }
      });
    }
    
    // Check access
    const hasAccess = await projectService.hasAccess(projectId, userId);
    if (!hasAccess) {
      return createResponse(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      });
    }
    
    const { resolved } = JSON.parse(event.body || '{}');
    
    const comment = await commentService.resolveComment(commentId, resolved !== false);
    
    return createResponse(200, {
      success: true,
      data: comment
    });
  } catch (error: any) {
    console.error('Error resolving comment:', error);
    return createResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
}
