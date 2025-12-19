import { WebSocketMessage, WebSocketEvent } from '../types';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number = 1000;
  private maxReconnectTimeout: number = 30000;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private listeners: Map<string, Set<(event: WebSocketEvent) => void>> = new Map();
  private projectId: string = '';
  private token: string = '';

  connect(projectId: string, token: string) {
    this.projectId = projectId;
    this.token = token;
    
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    const url = `${wsUrl}?token=${token}&project_id=${projectId}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectTimeout = 1000;
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketEvent = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      
      // Check attempts before incrementing to avoid race condition
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached. Please refresh the page.');
        return;
      }
      
      // Increment attempt counter
      this.reconnectAttempts++;
      
      // Reconnect with exponential backoff
      setTimeout(() => {
        this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, this.maxReconnectTimeout);
        console.log(`Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect(this.projectId, this.token);
      }, this.reconnectTimeout);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  on(eventType: string, callback: (event: WebSocketEvent) => void) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: (event: WebSocketEvent) => void) {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private handleMessage(event: WebSocketEvent) {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }
}

export const wsService = new WebSocketService();
