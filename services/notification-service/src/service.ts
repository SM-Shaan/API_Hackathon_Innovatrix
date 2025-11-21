import { NotificationRepository, CreateNotificationDto, Notification } from './repository';
import { EmailService } from './email';
import { WebSocketManager, WebSocketMessage } from './websocket';
import { DomainEvent, EventTypes } from './events';
import { Logger } from './logger';

export class NotificationService {
  constructor(
    private repository: NotificationRepository,
    private emailService: EmailService,
    private wsManager: WebSocketManager | null,
    private logger: Logger
  ) {}

  /**
   * Create and send a notification
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    // Save notification to database
    const notification = await this.repository.create(dto);
    this.logger.info({ notificationId: notification.id, type: dto.type }, 'Notification created');

    // Send based on type
    if (dto.type === 'EMAIL') {
      await this.sendEmailNotification(notification);
    } else if (dto.type === 'WEBSOCKET' && this.wsManager) {
      await this.sendWebSocketNotification(notification);
    }

    return notification;
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    const result = await this.emailService.sendEmail({
      to: notification.email,
      subject: notification.subject,
      html: notification.content,
    });

    if (result.success) {
      await this.repository.updateStatus(notification.id, 'SENT');
    } else {
      await this.repository.updateStatus(notification.id, 'FAILED');
    }
  }

  /**
   * Send WebSocket notification
   */
  private async sendWebSocketNotification(notification: Notification): Promise<void> {
    if (!this.wsManager) return;

    const message: WebSocketMessage = {
      type: 'notification',
      channel: notification.channel,
      payload: {
        id: notification.id,
        subject: notification.subject,
        content: notification.content,
        metadata: notification.metadata,
      },
      timestamp: new Date().toISOString(),
    };

    let sent = 0;
    if (notification.user_id) {
      sent = this.wsManager.sendToUser(notification.user_id, message);
    } else {
      sent = this.wsManager.sendToEmail(notification.email, message);
    }

    if (sent > 0) {
      await this.repository.updateStatus(notification.id, 'SENT');
    }
  }

  /**
   * Handle domain events and create appropriate notifications
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    this.logger.info({ eventType: event.type, eventId: event.id }, 'Processing event for notifications');

    switch (event.type) {
      case EventTypes.PLEDGE_COMPLETED:
        await this.handlePledgeCompleted(event);
        break;

      case EventTypes.PAYMENT_COMPLETED:
        await this.handlePaymentCompleted(event);
        break;

      case EventTypes.CAMPAIGN_GOAL_REACHED:
        await this.handleCampaignGoalReached(event);
        break;

      case EventTypes.USER_REGISTERED:
        await this.handleUserRegistered(event);
        break;

      default:
        // Broadcast event to websocket clients for real-time updates
        if (this.wsManager) {
          this.wsManager.broadcast('global', {
            type: 'event',
            channel: 'global',
            payload: {
              eventType: event.type,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              data: event.payload,
            },
            timestamp: event.timestamp,
          });
        }
    }
  }

  private async handlePledgeCompleted(event: DomainEvent): Promise<void> {
    const { donorEmail, donorName, amount, campaignTitle, pledgeId } = event.payload;

    if (!donorEmail) return;

    // Send email notification
    const emailTemplate = EmailService.donationReceivedTemplate({
      donorName: (donorName as string) || 'Donor',
      amount: amount as number,
      campaignTitle: (campaignTitle as string) || 'Campaign',
      transactionId: pledgeId as string,
    });

    await this.createNotification({
      email: donorEmail as string,
      type: 'EMAIL',
      channel: 'donation',
      subject: emailTemplate.subject,
      content: emailTemplate.html,
      metadata: { pledgeId, campaignTitle },
    });

    // Send WebSocket notification
    if (this.wsManager) {
      await this.createNotification({
        email: donorEmail as string,
        type: 'WEBSOCKET',
        channel: 'donation',
        subject: 'Donation Received',
        content: `Thank you for donating $${amount} to ${campaignTitle}!`,
        metadata: { pledgeId, amount, campaignTitle },
      });
    }
  }

  private async handlePaymentCompleted(event: DomainEvent): Promise<void> {
    const { donorEmail, donorName, amount, campaignTitle } = event.payload;

    if (!donorEmail) return;

    const emailTemplate = EmailService.paymentConfirmedTemplate({
      donorName: (donorName as string) || 'Donor',
      amount: amount as number,
      campaignTitle: (campaignTitle as string) || 'Campaign',
    });

    await this.createNotification({
      email: donorEmail as string,
      type: 'EMAIL',
      channel: 'payment',
      subject: emailTemplate.subject,
      content: emailTemplate.html,
      metadata: event.payload,
    });
  }

  private async handleCampaignGoalReached(event: DomainEvent): Promise<void> {
    const { ownerEmail, ownerName, campaignTitle, goalAmount, totalRaised } = event.payload;

    if (!ownerEmail) return;

    const emailTemplate = EmailService.campaignGoalReachedTemplate({
      ownerName: (ownerName as string) || 'Campaign Owner',
      campaignTitle: (campaignTitle as string) || 'Campaign',
      goalAmount: goalAmount as number,
      totalRaised: totalRaised as number,
    });

    await this.createNotification({
      email: ownerEmail as string,
      type: 'EMAIL',
      channel: 'campaign',
      subject: emailTemplate.subject,
      content: emailTemplate.html,
      metadata: event.payload,
    });

    // Broadcast to all connected clients
    if (this.wsManager) {
      this.wsManager.broadcastToAll({
        type: 'campaign_goal_reached',
        channel: 'global',
        payload: { campaignTitle, goalAmount, totalRaised },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async handleUserRegistered(event: DomainEvent): Promise<void> {
    const { email, name, userId } = event.payload;

    if (!email) return;

    await this.createNotification({
      user_id: userId as string,
      email: email as string,
      type: 'EMAIL',
      channel: 'welcome',
      subject: 'Welcome to CareForAll!',
      content: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to CareForAll!</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Hi ${name || 'there'}!</h2>
            <p>Thank you for joining CareForAll. You can now:</p>
            <ul>
              <li>Create campaigns to raise funds</li>
              <li>Donate to causes you care about</li>
              <li>Track your donation history</li>
            </ul>
            <p>Start making a difference today!</p>
          </div>
        </div>
      `,
      metadata: { userId },
    });
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    return this.repository.findByUserId(userId, limit);
  }

  /**
   * Get notifications by email
   */
  async getNotificationsByEmail(email: string, limit = 50): Promise<Notification[]> {
    return this.repository.findByEmail(email, limit);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification | null> {
    return this.repository.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    return this.repository.markAllAsRead(userId);
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.repository.getUnreadCount(userId);
  }

  /**
   * Get WebSocket stats
   */
  getWebSocketStats(): { connectedClients: number } {
    return {
      connectedClients: this.wsManager?.getConnectedClients() || 0,
    };
  }
}
