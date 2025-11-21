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
  private publisher: Redis;
  private subscriber: Redis;
  private handlers: Map<string, EventHandler[]> = new Map();
  private logger: Logger;

  constructor(redis: Redis, logger: Logger) {
    this.publisher = redis.duplicate();
    this.subscriber = redis.duplicate();
    this.logger = logger;
  }

  async publish(event: Omit<DomainEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: DomainEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    this.logger.info({ event: fullEvent }, `Publishing event: ${event.type}`);
    await this.publisher.publish('events', JSON.stringify(fullEvent));
  }

  subscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
    this.logger.info(`Subscribed to event: ${eventType}`);
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe('events');
    this.subscriber.on('message', async (_, message) => {
      try {
        const event = JSON.parse(message) as DomainEvent;
        const handlers = this.handlers.get(event.type) || [];

        this.logger.debug({ eventType: event.type, handlerCount: handlers.length }, 'Received event');

        for (const handler of handlers) {
          try {
            await handler(event);
          } catch (error) {
            this.logger.error({ error, eventType: event.type }, 'Error handling event');
          }
        }
      } catch (error) {
        this.logger.error({ error }, 'Error parsing event message');
      }
    });
    this.logger.info('Event bus started');
  }

  async close(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}

// Event types for payment service
export const PaymentEventTypes = {
  // Payment lifecycle events
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_AUTHORIZED: 'payment.authorized',
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Webhook events
  WEBHOOK_RECEIVED: 'webhook.received',
  WEBHOOK_PROCESSED: 'webhook.processed',
  WEBHOOK_DUPLICATE: 'webhook.duplicate',

  // Events to listen for
  PLEDGE_CREATED: 'pledge.created',
  PLEDGE_PAYMENT_REQUESTED: 'pledge.payment_requested',
} as const;
