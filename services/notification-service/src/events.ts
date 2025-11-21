import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from './logger';

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
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private logger: Logger;

  constructor(redis: Redis, logger: Logger) {
    this.subscriber = redis.duplicate();
    this.logger = logger;
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    this.logger.info(`Subscribed to event: ${eventType}`);
  }

  subscribeAll(handler: EventHandler): void {
    this.handlers.set('*', [handler]);
    this.logger.info('Subscribed to all events');
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe('events');
    this.subscriber.on('message', async (_, message) => {
      try {
        const event = JSON.parse(message) as DomainEvent;

        // Handle specific event type handlers
        const handlers = this.handlers.get(event.type) || [];
        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            this.logger.error({ error, eventType: event.type }, 'Error handling event');
          }
        }

        // Handle wildcard handlers
        const wildcardHandlers = this.handlers.get('*') || [];
        for (const handler of wildcardHandlers) {
          try {
            await handler(event);
          } catch (error) {
            this.logger.error({ error, eventType: event.type }, 'Error in wildcard handler');
          }
        }
      } catch (error) {
        this.logger.error({ error }, 'Error parsing event message');
      }
    });
    this.logger.info('Event bus started - listening for events');
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
  }
}

// Event types to listen for
export const EventTypes = {
  // Pledge events
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_COMPLETED: 'pledge.completed',
  PLEDGE_FAILED: 'pledge.failed',

  // Payment events
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',

  // Campaign events
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_GOAL_REACHED: 'campaign.goal_reached',

  // User events
  USER_REGISTERED: 'user.registered',
} as const;
