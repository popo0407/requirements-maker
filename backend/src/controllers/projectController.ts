import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { projectService } from '../services/projectService';
import { ApiResponse } from '../models/types';
import { extractUserIdFromAuthHeader } from '../utils/auth';
import * as fs from 'fs';
import * as path from 'path';
import { query } from '../utils/database';

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

/**
 * Initialize Database (Development only)
 */
export async function initDb(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('Initializing database...');
    
    // 1. Create tables
    // Note: In Lambda, the path might be different. We'll try a few locations.
    const possiblePaths = [
      path.join(__dirname, '../../migrations/001_initial_schema.sql'),
      path.join(process.cwd(), 'migrations/001_initial_schema.sql'),
      '/var/task/migrations/001_initial_schema.sql'
    ];
    
    let sql = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        sql = fs.readFileSync(p, 'utf8');
        console.log(`Found migration file at: ${p}`);
        break;
      }
    }
    
    if (!sql) {
      // Fallback: hardcoded minimal schema if file not found
      sql = `
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";
        CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS projects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, description TEXT, owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, current_phase VARCHAR(50) NOT NULL DEFAULT 'idea', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS project_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, role VARCHAR(50) NOT NULL DEFAULT 'viewer', created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id, user_id));
        CREATE TABLE IF NOT EXISTS phases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, phase_type VARCHAR(50) NOT NULL, data JSONB NOT NULL DEFAULT '{}', status VARCHAR(50) NOT NULL DEFAULT 'in_progress', completed_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id, phase_type));
        CREATE TABLE IF NOT EXISTS comments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, phase_type VARCHAR(50) NOT NULL, content TEXT NOT NULL, position JSONB, resolved BOOLEAN DEFAULT FALSE, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS history (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE SET NULL, phase_type VARCHAR(50) NOT NULL, action VARCHAR(50) NOT NULL, data_before JSONB, data_after JSONB, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);
      `;
    }
    
    // Execute SQL (split by semicolon to handle multiple statements if needed, 
    // but pg pool.query can handle multiple statements if they are separated by ;)
    await query(sql);
    
    // 2. Create default user
    await query(`
      INSERT INTO users (id, email, name, password_hash)
      VALUES ('00000000-0000-0000-0000-000000000000', 'guest@example.com', 'Guest User', 'no-password')
      ON CONFLICT (id) DO NOTHING
    `);

    return createResponse(200, {
      success: true,
      data: { message: 'Database initialized successfully' }
    });
  } catch (error: any) {
    console.error('Error initializing database:', error);
    return createResponse(500, {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
}
