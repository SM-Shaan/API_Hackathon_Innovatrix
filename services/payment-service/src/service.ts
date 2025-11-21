import { Pool } from 'pg';
import { PaymentRepository, Payment, CreatePaymentDto } from './repository';
import { PaymentState, PaymentStateMachine, StateTransitionResult } from './state-machine';
import { IdempotencyService } from './idempotency';
import { EventBus, PaymentEventTypes } from './events';
import { Logger } from './logger';

export interface InitiatePaymentDto {
  pledge_id: string;
  amount: number;
  currency?: string;
  idempotency_key: string;
  donor_email?: string;
  campaign_id?: string;
}

export interface WebhookPayload {
  webhook_id: string;
  event_type: string;
  provider: string;
  provider_payment_id: string;
  provider_ref?: string;
  amount?: number;
  failure_reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentResult {
  payment: Payment;
  transitionResult?: StateTransitionResult;
  wasIdempotent: boolean;
}

// Mapping from provider webhook event types to our internal states
const WEBHOOK_STATE_MAP: Record<string, PaymentState> = {
  'payment_intent.created': PaymentState.PENDING,
  'payment_intent.authorized': PaymentState.AUTHORIZED,
  'charge.authorized': PaymentState.AUTHORIZED,
  'payment_intent.captured': PaymentState.CAPTURED,
  'charge.captured': PaymentState.CAPTURED,
  'payment_intent.succeeded': PaymentState.COMPLETED,
  'charge.succeeded': PaymentState.COMPLETED,
  'payment_intent.payment_failed': PaymentState.FAILED,
  'charge.failed': PaymentState.FAILED,
  'charge.refunded': PaymentState.REFUNDED,
};

export class PaymentService {
  constructor(
    private repository: PaymentRepository,
    private idempotencyService: IdempotencyService,
    private eventBus: EventBus,
    private pool: Pool,
    private logger: Logger
  ) {}

  /**
   * Initiate a new payment for a pledge
   * Uses idempotency to prevent duplicate payments
   */
  async initiatePayment(dto: InitiatePaymentDto): Promise<PaymentResult> {
    this.logger.info({ pledgeId: dto.pledge_id, amount: dto.amount }, 'Initiating payment');

    // Check idempotency - prevent duplicate payment creation
    const existingPayment = await this.repository.findByIdempotencyKey(dto.idempotency_key);
    if (existingPayment) {
      this.logger.info({ paymentId: existingPayment.id }, 'Returning existing payment (idempotent)');
      return {
        payment: existingPayment,
        wasIdempotent: true,
      };
    }

    // Create new payment
    const payment = await this.repository.create({
      pledge_id: dto.pledge_id,
      amount: dto.amount,
      currency: dto.currency,
      idempotency_key: dto.idempotency_key,
      metadata: {
        donor_email: dto.donor_email,
        campaign_id: dto.campaign_id,
      },
    });

    // Publish event
    await this.eventBus.publish({
      type: PaymentEventTypes.PAYMENT_CREATED,
      aggregateType: 'payment',
      aggregateId: payment.id,
      payload: {
        paymentId: payment.id,
        pledgeId: payment.pledge_id,
        amount: payment.amount,
        currency: payment.currency,
      },
    });

    this.logger.info({ paymentId: payment.id }, 'Payment created');

    return {
      payment,
      wasIdempotent: false,
    };
  }

  /**
   * Process a webhook from payment provider
   * Handles idempotency and state machine transitions
   */
  async processWebhook(payload: WebhookPayload): Promise<PaymentResult> {
    this.logger.info(
      { webhookId: payload.webhook_id, eventType: payload.event_type },
      'Processing webhook'
    );

    // Check if webhook already processed (idempotency)
    const existingWebhook = await this.repository.findWebhookByWebhookId(payload.webhook_id);
    if (existingWebhook?.processed) {
      this.logger.info({ webhookId: payload.webhook_id }, 'Webhook already processed (idempotent)');

      const payment = await this.repository.findById(existingWebhook.payment_id);
      if (!payment) {
        throw new Error(`Payment not found for webhook: ${payload.webhook_id}`);
      }

      await this.eventBus.publish({
        type: PaymentEventTypes.WEBHOOK_DUPLICATE,
        aggregateType: 'webhook',
        aggregateId: payload.webhook_id,
        payload: { webhookId: payload.webhook_id, paymentId: payment.id },
      });

      return {
        payment,
        wasIdempotent: true,
      };
    }

    // Find the payment by provider payment ID
    let payment = await this.repository.findByProviderPaymentId(payload.provider_payment_id);

    // If not found by provider ID, this might be the first webhook - try to match by other means
    if (!payment && payload.metadata?.pledge_id) {
      payment = await this.repository.findByPledgeId(payload.metadata.pledge_id as string);
    }

    if (!payment) {
      this.logger.warn({ payload }, 'Payment not found for webhook');
      throw new Error(`Payment not found for provider payment ID: ${payload.provider_payment_id}`);
    }

    // Determine target state from webhook event type
    const targetState = WEBHOOK_STATE_MAP[payload.event_type];
    if (!targetState) {
      this.logger.warn({ eventType: payload.event_type }, 'Unknown webhook event type');
      throw new Error(`Unknown webhook event type: ${payload.event_type}`);
    }

    // Use state machine to validate transition
    const transitionResult = PaymentStateMachine.canTransition(payment.state, targetState);

    if (!transitionResult.allowed) {
      this.logger.warn(
        {
          paymentId: payment.id,
          currentState: payment.state,
          targetState,
          reason: transitionResult.reason,
        },
        'State transition rejected'
      );

      // Still save the webhook event for audit purposes
      const client = await this.repository.getTransaction();
      try {
        await this.repository.saveWebhookEvent(
          payment.id,
          payload.webhook_id,
          payload.event_type,
          payload.provider,
          payload as unknown as Record<string, unknown>,
          client
        );
        await this.repository.markWebhookProcessed(payload.webhook_id, client);
        await this.repository.commitTransaction(client);
      } catch (error) {
        await this.repository.rollbackTransaction(client);
        throw error;
      }

      // Return current payment state without changing it
      return {
        payment,
        transitionResult,
        wasIdempotent: false,
      };
    }

    // Process the state transition in a transaction
    const client = await this.repository.getTransaction();
    try {
      // Save webhook event
      await this.repository.saveWebhookEvent(
        payment.id,
        payload.webhook_id,
        payload.event_type,
        payload.provider,
        payload as unknown as Record<string, unknown>,
        client
      );

      // Update payment state (skip if same state)
      if (payment.state !== targetState) {
        payment = (await this.repository.updateState(
          payment.id,
          targetState,
          {
            provider_payment_id: payload.provider_payment_id,
            provider_ref: payload.provider_ref,
            failure_reason: payload.failure_reason,
          },
          client
        ))!;
      }

      // Mark webhook as processed
      await this.repository.markWebhookProcessed(payload.webhook_id, client);

      await this.repository.commitTransaction(client);
    } catch (error) {
      await this.repository.rollbackTransaction(client);
      throw error;
    }

    // Publish appropriate event
    const eventType = this.getEventTypeForState(targetState);
    await this.eventBus.publish({
      type: eventType,
      aggregateType: 'payment',
      aggregateId: payment.id,
      payload: {
        paymentId: payment.id,
        pledgeId: payment.pledge_id,
        amount: payment.amount,
        state: payment.state,
        providerPaymentId: payment.provider_payment_id,
      },
    });

    this.logger.info(
      { paymentId: payment.id, newState: payment.state },
      'Payment state updated'
    );

    return {
      payment,
      transitionResult,
      wasIdempotent: false,
    };
  }

  /**
   * Get payment by ID
   */
  async getPayment(id: string): Promise<Payment | null> {
    return this.repository.findById(id);
  }

  /**
   * Get payment by pledge ID
   */
  async getPaymentByPledge(pledgeId: string): Promise<Payment | null> {
    return this.repository.findByPledgeId(pledgeId);
  }

  /**
   * Get all payments with optional filters
   */
  async getAllPayments(filters?: { state?: PaymentState; pledgeId?: string }): Promise<Payment[]> {
    return this.repository.findAll(filters);
  }

  /**
   * Simulate a payment provider call (for demo purposes)
   * In production, this would call Stripe/PayPal API
   */
  async simulateProviderAuthorization(paymentId: string): Promise<Payment> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Simulate provider authorization
    const providerPaymentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process as if we received a webhook
    const result = await this.processWebhook({
      webhook_id: `wh_${Date.now()}_auth`,
      event_type: 'payment_intent.authorized',
      provider: 'stripe',
      provider_payment_id: providerPaymentId,
      provider_ref: `ch_${Date.now()}`,
    });

    return result.payment;
  }

  /**
   * Manually transition payment state (admin use)
   */
  async transitionState(
    paymentId: string,
    targetState: PaymentState,
    reason?: string
  ): Promise<PaymentResult> {
    const payment = await this.repository.findById(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const transitionResult = PaymentStateMachine.canTransition(payment.state, targetState);
    if (!transitionResult.allowed) {
      return {
        payment,
        transitionResult,
        wasIdempotent: false,
      };
    }

    const updatedPayment = await this.repository.updateState(paymentId, targetState, {
      failure_reason: reason,
    });

    if (!updatedPayment) {
      throw new Error('Failed to update payment state');
    }

    const eventType = this.getEventTypeForState(targetState);
    await this.eventBus.publish({
      type: eventType,
      aggregateType: 'payment',
      aggregateId: paymentId,
      payload: {
        paymentId,
        pledgeId: updatedPayment.pledge_id,
        amount: updatedPayment.amount,
        state: updatedPayment.state,
        reason,
      },
    });

    return {
      payment: updatedPayment,
      transitionResult,
      wasIdempotent: false,
    };
  }

  private getEventTypeForState(state: PaymentState): string {
    switch (state) {
      case PaymentState.AUTHORIZED:
        return PaymentEventTypes.PAYMENT_AUTHORIZED;
      case PaymentState.CAPTURED:
        return PaymentEventTypes.PAYMENT_CAPTURED;
      case PaymentState.COMPLETED:
        return PaymentEventTypes.PAYMENT_COMPLETED;
      case PaymentState.FAILED:
        return PaymentEventTypes.PAYMENT_FAILED;
      case PaymentState.REFUNDED:
        return PaymentEventTypes.PAYMENT_REFUNDED;
      default:
        return PaymentEventTypes.PAYMENT_CREATED;
    }
  }
}
