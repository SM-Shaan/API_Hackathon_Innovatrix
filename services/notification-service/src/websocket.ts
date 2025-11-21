import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { Logger } from './logger';

interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  email?: string;
  subscribedChannels: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  channel: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private logger: Logger;

  constructor(server: Server, logger: Logger) {
    this.logger = logger;
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.logger.info({ clientId }, 'WebSocket client connected');

      const client: WebSocketClient = {
        ws,
        subscribedChannels: new Set(['global']),
      };
      this.clients.set(clientId, client);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connected',
        channel: 'system',
        payload: { clientId, message: 'Welcome to CareForAll notifications' },
        timestamp: new Date().toISOString(),
      });

      ws.on('message', (data) => {
        this.handleMessage(clientId, data.toString());
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.logger.info({ clientId }, 'WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        this.logger.error({ error, clientId }, 'WebSocket error');
      });
    });

    this.logger.info('WebSocket server initialized');
  }

  private handleMessage(clientId: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (data.type) {
        case 'authenticate':
          client.userId = data.userId;
          client.email = data.email;
          client.subscribedChannels.add(`user:${data.userId}`);
          this.logger.info({ clientId, userId: data.userId }, 'Client authenticated');
          this.sendToClient(clientId, {
            type: 'authenticated',
            channel: 'system',
            payload: { userId: data.userId },
            timestamp: new Date().toISOString(),
          });
          break;

        case 'subscribe':
          if (data.channel) {
            client.subscribedChannels.add(data.channel);
            this.logger.info({ clientId, channel: data.channel }, 'Client subscribed to channel');
          }
          break;

        case 'unsubscribe':
          if (data.channel) {
            client.subscribedChannels.delete(data.channel);
          }
          break;

        case 'ping':
          this.sendToClient(clientId, {
            type: 'pong',
            channel: 'system',
            payload: {},
            timestamp: new Date().toISOString(),
          });
          break;

        default:
          this.logger.warn({ clientId, type: data.type }, 'Unknown message type');
      }
    } catch (error) {
      this.logger.error({ error, clientId }, 'Error handling WebSocket message');
    }
  }

  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  sendToUser(userId: string, message: WebSocketMessage): number {
    let count = 0;
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        count++;
      }
    }
    return count;
  }

  sendToEmail(email: string, message: WebSocketMessage): number {
    let count = 0;
    for (const [clientId, client] of this.clients) {
      if (client.email === email && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        count++;
      }
    }
    return count;
  }

  broadcast(channel: string, message: WebSocketMessage): number {
    let count = 0;
    for (const [clientId, client] of this.clients) {
      if (client.subscribedChannels.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
        count++;
      }
    }
    this.logger.debug({ channel, recipients: count }, 'Broadcast message sent');
    return count;
  }

  broadcastToAll(message: WebSocketMessage): number {
    return this.broadcast('global', message);
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  getClientsByUser(userId: string): string[] {
    const clientIds: string[] = [];
    for (const [clientId, client] of this.clients) {
      if (client.userId === userId) {
        clientIds.push(clientId);
      }
    }
    return clientIds;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
