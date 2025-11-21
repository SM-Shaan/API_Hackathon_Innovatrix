import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export type EventHandler = (event: DomainEvent) => Promise<void>;

export class EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(redis: Redis) {
    this.publisher = redis;
    this.subscriber = redis.duplicate();
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
    await this.subscriber.unsubscribe();
  }
}

export const EventTypes = {
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_DELETED: 'campaign.deleted',
  CAMPAIGN_GOAL_REACHED: 'campaign.goal_reached',
} as const;
