import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as projectController from './controllers/projectController';
import * as phaseController from './controllers/phaseController';
import * as commentController from './controllers/commentController';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { path, httpMethod } = event;
  console.log(`Method: ${httpMethod}, Path: ${path}`);

  // Handle CORS preflight requests
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: '',
    };
  }

  // Simple routing logic
  try {
    // Normalize path (remove /v1 prefix if present)
    const normalizedPath = path.startsWith('/v1') ? path.substring(3) : path;

    // Projects
    if (normalizedPath === '/projects') {
      if (httpMethod === 'GET') return await projectController.listProjects(event);
      if (httpMethod === 'POST') return await projectController.createProject(event);
    }

    // DB Init (Development only)
    if (normalizedPath === '/init-db') {
      return await projectController.initDb(event);
    }
    
    if (normalizedPath.match(/^\/projects\/[^\/]+$/)) {
      if (httpMethod === 'GET') return await projectController.getProject(event);
      if (httpMethod === 'PUT') return await projectController.updateProject(event);
      if (httpMethod === 'DELETE') return await projectController.deleteProject(event);
    }

    // Phases
    const phaseMatch = normalizedPath.match(/^\/projects\/([^\/]+)\/phases\/([^\/]+)$/);
    if (phaseMatch) {
      const projectId = phaseMatch[1];
      const phaseType = phaseMatch[2];
      event.pathParameters = { ...event.pathParameters, project_id: projectId, phase_type: phaseType };
      
      if (httpMethod === 'GET') return await phaseController.getPhase(event);
      if (httpMethod === 'PUT') return await phaseController.updatePhase(event);
    }

    const completeMatch = normalizedPath.match(/^\/projects\/([^\/]+)\/phases\/([^\/]+)\/complete$/);
    if (completeMatch) {
      const projectId = completeMatch[1];
      const phaseType = completeMatch[2];
      event.pathParameters = { ...event.pathParameters, project_id: projectId, phase_type: phaseType };
      if (httpMethod === 'POST') return await phaseController.completePhase(event);
    }

    // AI Assist
    const aiMatch = normalizedPath.match(/^\/projects\/([^\/]+)\/ai-assist$/);
    if (aiMatch) {
      const projectId = aiMatch[1];
      event.pathParameters = { ...event.pathParameters, project_id: projectId };
      if (httpMethod === 'POST') return await phaseController.aiAssist(event);
    }

    // Comments
    const commentsMatch = normalizedPath.match(/^\/projects\/([^\/]+)\/comments$/);
    if (commentsMatch) {
      const projectId = commentsMatch[1];
      event.pathParameters = { ...event.pathParameters, project_id: projectId };
      if (httpMethod === 'GET') return await commentController.listComments(event);
      if (httpMethod === 'POST') return await commentController.createComment(event);
    }

    const commentDetailMatch = normalizedPath.match(/^\/projects\/([^\/]+)\/comments\/([^\/]+)$/);
    if (commentDetailMatch) {
      const projectId = commentDetailMatch[1];
      const commentId = commentDetailMatch[2];
      event.pathParameters = { ...event.pathParameters, project_id: projectId, comment_id: commentId };
      if (httpMethod === 'PUT') return await commentController.resolveComment(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: `Route not found: ${httpMethod} ${path}` }),
    };
  } catch (error: any) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Internal Server Error', error: error.message }),
    };
  }
};
