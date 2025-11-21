import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlationId?: string;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async publish(event: Omit<DomainEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: DomainEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    await this.publisher.publish('events', JSON.stringify(fullEvent));
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe('events');
    this.subscriber.on('message', async (_, message) => {
      const event = JSON.parse(message) as DomainEvent;
      const handlers = this.handlers.get(event.type) || [];
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Error handling event ${event.type}:`, error);
        }
      }
    });
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

// Event types
export const EventTypes = {
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_COMPLETED: 'pledge.completed',
  PLEDGE_FAILED: 'pledge.failed',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_GOAL_REACHED: 'campaign.goal_reached',
} as const;
