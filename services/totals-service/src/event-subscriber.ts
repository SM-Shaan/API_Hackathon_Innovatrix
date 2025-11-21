import Redis from 'ioredis';
import { TotalsService } from './service';
import { Logger } from './logger';

interface DomainEvent {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export class EventSubscriber {
  private subscriber: Redis;

  constructor(
    redis: Redis,
    private totalsService: TotalsService,
    private logger: Logger
  ) {
    this.subscriber = redis.duplicate();
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe('events');

    this.subscriber.on('message', async (_, message) => {
      try {
        const event = JSON.parse(message) as DomainEvent;
        await this.handleEvent(event);
      } catch (error) {
        this.logger.error({ error, message }, 'Failed to process event');
      }
    });

    this.logger.info('Event subscriber started');
  }

  private async handleEvent(event: DomainEvent): Promise<void> {
    this.logger.debug({ eventType: event.type, eventId: event.id }, 'Processing event');

    switch (event.type) {
      case 'pledge.completed':
        await this.totalsService.handlePledgeCompleted(
          event.payload.campaignId as string,
          event.payload.amount as number
        );
        break;

      case 'pledge.failed':
        // If a pledge was previously counted and now failed, decrement
        if (event.payload.amount) {
          await this.totalsService.handlePledgeFailed(
            event.payload.campaignId as string,
            event.payload.amount as number
          );
        }
        break;

      case 'campaign.created':
        await this.totalsService.handleCampaignCreated(
          event.payload.campaign?.id as string || event.aggregateId
        );
        break;

      case 'payment.completed':
        // Payment completed also triggers total update
        if (event.payload.campaignId && event.payload.amount) {
          await this.totalsService.handlePledgeCompleted(
            event.payload.campaignId as string,
            event.payload.amount as number
          );
        }
        break;

      default:
        // Ignore unhandled events
        break;
    }
  }

  async stop(): Promise<void> {
    await this.subscriber.unsubscribe();
    await this.subscriber.quit();
  }
}
