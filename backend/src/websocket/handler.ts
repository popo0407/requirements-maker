import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ApiGatewayManagementApi } from 'aws-sdk';
import { query, queryOne } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { WebSocketMessage, WebSocketEvent } from '../models/types';
import { verifyToken } from '../utils/auth';

/**
 * WebSocket handler for real-time collaboration
 */

const apiGateway = new ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_ENDPOINT
});

/**
 * Extract user ID from JWT token
 * 
 * SECURITY NOTE: This validates JWT tokens for WebSocket connections.
 * Ensure JWT_SECRET is properly configured in environment variables.
 * Tokens are passed via query string parameter during connection.
 */
function getUserIdFromToken(token: string): string {
  try {
    const payload = verifyToken(token);
    return payload.userId;
  } catch (error: any) {
    throw new Error('Invalid authentication token: ' + error.message);
  }
}

/**
 * Handle WebSocket connection
 */
export async function handleConnect(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;
    const token = event.queryStringParameters?.token;
    const projectId = event.queryStringParameters?.project_id;
    
    if (!token || !projectId) {
      return { statusCode: 400, body: 'Missing token or project_id' };
    }
    
    const userId = getUserIdFromToken(token);
    
    // Store connection
    await query(`
      INSERT INTO connections (connection_id, project_id, user_id, connected_at, last_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [connectionId, projectId, userId]);
    
    // Notify others about new connection
    await broadcastToProject(projectId, connectionId, {
      type: 'presence',
      user: {
        id: userId,
        name: 'User Name' // Should fetch from users table
      },
      data: {
        status: 'connected'
      },
      timestamp: new Date().toISOString()
    });
    
    console.log(`Connection established: ${connectionId} for project ${projectId}`);
    
    return { statusCode: 200, body: 'Connected' };
  } catch (error: any) {
    console.error('Error handling connect:', error);
    return { statusCode: 500, body: 'Failed to connect: ' + error.message };
  }
}

/**
 * Handle WebSocket disconnection
 */
export async function handleDisconnect(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;
    
    // Get connection info before deleting
    const connection = await queryOne<any>(`
      SELECT * FROM connections WHERE connection_id = $1
    `, [connectionId]);
    
    if (connection) {
      // Delete connection
      await query(`
        DELETE FROM connections WHERE connection_id = $1
      `, [connectionId]);
      
      // Notify others about disconnection
      await broadcastToProject(connection.project_id, connectionId, {
        type: 'presence',
        user: {
          id: connection.user_id,
          name: 'User Name'
        },
        data: {
          status: 'disconnected'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`Connection closed: ${connectionId}`);
    
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error: any) {
    console.error('Error handling disconnect:', error);
    return { statusCode: 500, body: 'Failed to disconnect: ' + error.message };
  }
}

/**
 * Handle WebSocket messages
 */
export async function handleMessage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const connectionId = event.requestContext.connectionId!;
    const message: WebSocketMessage = JSON.parse(event.body || '{}');
    
    // Get connection info
    const connection = await queryOne<any>(`
      SELECT * FROM connections WHERE connection_id = $1
    `, [connectionId]);
    
    if (!connection) {
      return { statusCode: 404, body: 'Connection not found' };
    }
    
    // Update last active
    await query(`
      UPDATE connections
      SET last_active = CURRENT_TIMESTAMP
      WHERE connection_id = $1
    `, [connectionId]);
    
    // Handle different message types
    switch (message.action) {
      case 'edit':
        await handleEditMessage(connection, message);
        break;
      
      case 'cursor':
        await handleCursorMessage(connection, message);
        break;
      
      case 'presence':
        await handlePresenceMessage(connection, message);
        break;
      
      case 'comment':
        await handleCommentMessage(connection, message);
        break;
      
      default:
        console.warn(`Unknown action: ${message.action}`);
    }
    
    return { statusCode: 200, body: 'Message processed' };
  } catch (error: any) {
    console.error('Error handling message:', error);
    return { statusCode: 500, body: 'Failed to process message: ' + error.message };
  }
}

/**
 * Handle edit message
 */
async function handleEditMessage(connection: any, message: WebSocketMessage) {
  const event: WebSocketEvent = {
    type: 'edit',
    user: {
      id: connection.user_id,
      name: 'User Name' // Should fetch from users table
    },
    data: message.data,
    timestamp: new Date().toISOString()
  };
  
  await broadcastToProject(
    connection.project_id,
    connection.connection_id,
    event
  );
}

/**
 * Handle cursor message
 */
async function handleCursorMessage(connection: any, message: WebSocketMessage) {
  const event: WebSocketEvent = {
    type: 'cursor',
    user: {
      id: connection.user_id,
      name: 'User Name'
    },
    data: message.data,
    timestamp: new Date().toISOString()
  };
  
  await broadcastToProject(
    connection.project_id,
    connection.connection_id,
    event
  );
}

/**
 * Handle presence message
 */
async function handlePresenceMessage(connection: any, message: WebSocketMessage) {
  const event: WebSocketEvent = {
    type: 'presence',
    user: {
      id: connection.user_id,
      name: 'User Name'
    },
    data: message.data,
    timestamp: new Date().toISOString()
  };
  
  await broadcastToProject(
    connection.project_id,
    connection.connection_id,
    event
  );
}

/**
 * Handle comment message
 */
async function handleCommentMessage(connection: any, message: WebSocketMessage) {
  // Save comment to database
  await query(`
    INSERT INTO comments (id, project_id, user_id, phase_type, content, position, resolved)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    uuidv4(),
    connection.project_id,
    connection.user_id,
    message.data.phase_type,
    message.data.content,
    JSON.stringify(message.data.position),
    false
  ]);
  
  const event: WebSocketEvent = {
    type: 'comment',
    user: {
      id: connection.user_id,
      name: 'User Name'
    },
    data: message.data,
    timestamp: new Date().toISOString()
  };
  
  await broadcastToProject(
    connection.project_id,
    connection.connection_id,
    event
  );
}

/**
 * Broadcast message to all connections in a project
 */
async function broadcastToProject(
  projectId: string,
  excludeConnectionId: string,
  event: WebSocketEvent
) {
  // Get all active connections for the project
  const connections = await query<any>(`
    SELECT connection_id
    FROM connections
    WHERE project_id = $1 AND connection_id != $2
  `, [projectId, excludeConnectionId]);
  
  const payload = JSON.stringify(event);
  
  // Send to all connections
  const sendPromises = connections.map(async (conn) => {
    try {
      await apiGateway.postToConnection({
        ConnectionId: conn.connection_id,
        Data: payload
      }).promise();
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Connection is stale, remove it
        await query(`
          DELETE FROM connections WHERE connection_id = $1
        `, [conn.connection_id]);
      } else {
        console.error(`Failed to send to ${conn.connection_id}:`, error);
      }
    }
  });
  
  await Promise.all(sendPromises);
}

/**
 * Send message to a specific connection
 */
async function sendToConnection(connectionId: string, event: WebSocketEvent) {
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(event)
    }).promise();
  } catch (error: any) {
    if (error.statusCode === 410) {
      // Connection is stale, remove it
      await query(`
        DELETE FROM connections WHERE connection_id = $1
      `, [connectionId]);
    } else {
      console.error(`Failed to send to ${connectionId}:`, error);
      throw error;
    }
  }
}
