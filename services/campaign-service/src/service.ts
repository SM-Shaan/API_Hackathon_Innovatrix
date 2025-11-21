import { CampaignRepository, Campaign, CreateCampaignDto, UpdateCampaignDto } from './repository';
import { EventBus, EventTypes } from './events';
import { Logger } from './logger';

export class CampaignService {
  constructor(
    private repository: CampaignRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    this.logger.info({ title: dto.title, ownerId: dto.owner_id }, 'Creating new campaign');

    const campaign = await this.repository.create(dto);

    await this.eventBus.publish({
      type: EventTypes.CAMPAIGN_CREATED,
      aggregateType: 'campaign',
      aggregateId: campaign.id,
      payload: { campaign },
    });

    this.logger.info({ campaignId: campaign.id }, 'Campaign created successfully');
    return campaign;
  }

  async getById(id: string): Promise<Campaign | null> {
    return this.repository.findById(id);
  }

  async getAll(status?: string): Promise<Campaign[]> {
    return this.repository.findAll(status);
  }

  async getByOwner(ownerId: string): Promise<Campaign[]> {
    return this.repository.findByOwner(ownerId);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign | null> {
    this.logger.info({ campaignId: id }, 'Updating campaign');

    const campaign = await this.repository.update(id, dto);

    if (campaign) {
      await this.eventBus.publish({
        type: EventTypes.CAMPAIGN_UPDATED,
        aggregateType: 'campaign',
        aggregateId: campaign.id,
        payload: { campaign },
      });
    }

    return campaign;
  }

  async updateAmount(id: string, amount: number): Promise<Campaign | null> {
    this.logger.info({ campaignId: id, amount }, 'Updating campaign amount');

    const campaign = await this.repository.updateAmount(id, amount);

    if (campaign) {
      // Check if goal is reached
      if (campaign.current_amount >= campaign.goal_amount && campaign.status === 'ACTIVE') {
        await this.eventBus.publish({
          type: EventTypes.CAMPAIGN_GOAL_REACHED,
          aggregateType: 'campaign',
          aggregateId: campaign.id,
          payload: { campaign },
        });
        this.logger.info({ campaignId: id }, 'Campaign goal reached!');
      }
    }

    return campaign;
  }

  async delete(id: string): Promise<boolean> {
    this.logger.info({ campaignId: id }, 'Deleting campaign');

    const deleted = await this.repository.delete(id);

    if (deleted) {
      await this.eventBus.publish({
        type: EventTypes.CAMPAIGN_DELETED,
        aggregateType: 'campaign',
        aggregateId: id,
        payload: { campaignId: id },
      });
    }

    return deleted;
  }

  async getStats(): Promise<{ total: number; active: number; completed: number; totalRaised: number }> {
    const campaigns = await this.repository.findAll();
    return {
      total: campaigns.length,
      active: campaigns.filter(c => c.status === 'ACTIVE').length,
      completed: campaigns.filter(c => c.status === 'COMPLETED').length,
      totalRaised: campaigns.reduce((sum, c) => sum + c.current_amount, 0),
    };
  }
}
