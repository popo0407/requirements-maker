import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { projectService } from '../services/projectService';
import { ApiResponse } from '../models/types';

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
 * Extract user ID from event (from JWT token)
 * In production, this would decode the JWT token from Authorization header
 */
function getUserId(event: APIGatewayProxyEvent): string {
  // Mock implementation - in production, decode JWT
  const authHeader = event.headers.Authorization || event.headers.authorization;
  // This should decode JWT and extract user ID
  return 'mock-user-id';
}

/**
 * List projects
 */
export async function listProjects(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const page = parseInt(event.queryStringParameters?.page || '1');
    const limit = parseInt(event.queryStringParameters?.limit || '20');
    
    const { projects, total } = await projectService.getProjects(userId, page, limit);
    
    return createResponse(200, {
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total
        }
      }
    });
  } catch (error: any) {
    console.error('Error listing projects:', error);
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
 * Get project
 */
export async function getProject(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }
      });
    }
    
    // Check access
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
    
    const project = await projectService.getProject(projectId);
    
    if (!project) {
      return createResponse(404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found'
        }
      });
    }
    
    const members = await projectService.getProjectMembers(projectId);
    
    return createResponse(200, {
      success: true,
      data: {
        project: {
          ...project,
          members
        }
      }
    });
  } catch (error: any) {
    console.error('Error getting project:', error);
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
 * Create project
 */
export async function createProject(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const body = JSON.parse(event.body || '{}');
    
    const { name, description } = body;
    
    if (!name) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name is required'
        }
      });
    }
    
    const project = await projectService.createProject(name, userId, description);
    
    return createResponse(201, {
      success: true,
      data: {
        project
      }
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
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
 * Update project
 */
export async function updateProject(
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
    
    // Check edit permission
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
    
    const project = await projectService.updateProject(projectId, body);
    
    return createResponse(200, {
      success: true,
      data: {
        project
      }
    });
  } catch (error: any) {
    console.error('Error updating project:', error);
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
 * Delete project
 */
export async function deleteProject(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = getUserId(event);
    const projectId = event.pathParameters?.project_id;
    
    if (!projectId) {
      return createResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project ID is required'
        }
      });
    }
    
    // Check owner permission
    const isOwner = await projectService.isOwner(projectId, userId);
    if (!isOwner) {
      return createResponse(403, {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the owner can delete the project'
        }
      });
    }
    
    await projectService.deleteProject(projectId);
    
    return createResponse(200, {
      success: true,
      data: {}
    });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}
