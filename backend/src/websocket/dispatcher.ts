import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as handler from './handler';

export const dispatcher = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const routeKey = event.requestContext.routeKey;
  console.log(`WebSocket Route: ${routeKey}`);

  try {
    switch (routeKey) {
      case '$connect':
        return await handler.handleConnect(event);
      case '$disconnect':
        return await handler.handleDisconnect(event);
      case '$default':
        return await handler.handleMessage(event);
      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error: any) {
    console.error(error);
    return { statusCode: 500, body: error.message };
  }
};
