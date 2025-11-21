import { TotalsRepository, CampaignTotal } from './repository';
import { Logger } from './logger';

export class TotalsService {
  constructor(
    private repository: TotalsRepository,
    private logger: Logger
  ) {}

  async getTotal(campaignId: string): Promise<CampaignTotal | null> {
    return this.repository.getTotal(campaignId);
  }

  async getAllTotals(): Promise<CampaignTotal[]> {
    return this.repository.getAllTotals();
  }

  async handlePledgeCompleted(campaignId: string, amount: number): Promise<void> {
    this.logger.info({ campaignId, amount }, 'Incrementing campaign total');
    await this.repository.incrementTotal(campaignId, amount);
  }

  async handlePledgeFailed(campaignId: string, amount: number): Promise<void> {
    this.logger.info({ campaignId, amount }, 'Decrementing campaign total (pledge failed)');
    await this.repository.decrementTotal(campaignId, amount);
  }

  async handleCampaignCreated(campaignId: string): Promise<void> {
    this.logger.info({ campaignId }, 'Initializing campaign totals');
    await this.repository.initializeCampaign(campaignId);
  }

  async rebuildTotals(): Promise<void> {
    this.logger.info('Rebuilding all campaign totals from pledges');
    await this.repository.rebuildFromPledges();
    this.logger.info('Totals rebuild complete');
  }

  async getStats(): Promise<{
    totalCampaigns: number;
    totalRaised: number;
    totalPledges: number;
  }> {
    const totals = await this.repository.getAllTotals();
    return {
      totalCampaigns: totals.length,
      totalRaised: totals.reduce((sum, t) => sum + t.total_amount, 0),
      totalPledges: totals.reduce((sum, t) => sum + t.pledge_count, 0),
    };
  }
}
