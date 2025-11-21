import Stripe from 'stripe';
import { Logger } from './logger';

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  metadata: {
    pledge_id: string;
    donor_email?: string;
    campaign_id?: string;
    [key: string]: unknown;
  };
  idempotencyKey: string;
  description?: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Stripe.PaymentIntent | Stripe.Charge;
  };
}

export class StripeClient {
  private stripe: Stripe;

  constructor(
    private secretKey: string,
    private webhookSecret: string | undefined,
    private logger: Logger
  ) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    this.logger.info('Stripe client initialized');
  }

  /**
   * Create a PaymentIntent in Stripe
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
    try {
      this.logger.info(
        { amount: params.amount, currency: params.currency, pledgeId: params.metadata.pledge_id },
        'Creating Stripe PaymentIntent'
      );

      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(params.amount * 100), // Convert to cents
          currency: params.currency.toLowerCase(),
          metadata: params.metadata as Stripe.MetadataParam,
          description: params.description || `Donation for pledge ${params.metadata.pledge_id}`,
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          idempotencyKey: params.idempotencyKey,
        }
      );

      this.logger.info(
        { paymentIntentId: paymentIntent.id, status: paymentIntent.status },
        'Stripe PaymentIntent created'
      );

      return paymentIntent;
    } catch (error) {
      this.logger.error({ error, params }, 'Failed to create Stripe PaymentIntent');
      throw error;
    }
  }

  /**
   * Retrieve a PaymentIntent from Stripe
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      this.logger.error({ error, paymentIntentId }, 'Failed to retrieve Stripe PaymentIntent');
      throw error;
    }
  }

  /**
   * Verify webhook signature from Stripe
   */
  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string
  ): Stripe.Event | null {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      // In development, you might want to allow this, but in production it's a security risk
      return null;
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return event;
    } catch (error) {
      this.logger.error({ error }, 'Stripe webhook signature verification failed');
      throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Map Stripe event type to our internal event type
   */
  mapStripeEventToWebhookEvent(stripeEvent: Stripe.Event): {
    webhook_id: string;
    event_type: string;
    provider: string;
    provider_payment_id: string;
    provider_ref?: string;
    amount?: number;
    failure_reason?: string;
    metadata?: Record<string, unknown>;
  } {
    const eventType = stripeEvent.type;
    const eventObject = stripeEvent.data.object;

    let providerPaymentId: string;
    let amount: number | undefined;
    let failureReason: string | undefined;
    let providerRef: string | undefined;

    // Extract payment details based on event object type
    if ('object' in eventObject && eventObject.object === 'payment_intent') {
      const pi = eventObject as Stripe.PaymentIntent;
      providerPaymentId = pi.id;
      amount = pi.amount ? pi.amount / 100 : undefined; // Convert from cents
      failureReason = pi.last_payment_error?.message || undefined;
    } else if ('object' in eventObject && eventObject.object === 'charge') {
      const charge = eventObject as Stripe.Charge;
      // Charge events reference payment_intent
      providerPaymentId = (typeof charge.payment_intent === 'string' 
        ? charge.payment_intent 
        : charge.payment_intent?.id) || charge.id;
      providerRef = charge.id;
      amount = charge.amount ? charge.amount / 100 : undefined;
      failureReason = charge.failure_message || charge.outcome?.reason || undefined;
    } else {
      // Fallback: try to get ID from any object
      if ('id' in eventObject) {
        providerPaymentId = eventObject.id as string;
      } else {
        throw new Error(`Unable to extract payment ID from Stripe event type: ${eventType}`);
      }
    }

    // Map Stripe event types to our internal event types
    const eventTypeMap: Record<string, string> = {
      'payment_intent.created': 'payment_intent.created',
      'payment_intent.amount_capturable_updated': 'payment_intent.authorized',
      'payment_intent.processing': 'payment_intent.authorized',
      'payment_intent.succeeded': 'payment_intent.succeeded',
      'payment_intent.payment_failed': 'payment_intent.payment_failed',
      'payment_intent.canceled': 'payment_intent.payment_failed',
      'charge.succeeded': 'charge.succeeded',
      'charge.failed': 'charge.failed',
      'charge.refunded': 'charge.refunded',
      'charge.captured': 'charge.captured',
    };

    const mappedEventType = eventTypeMap[eventType] || eventType;

    return {
      webhook_id: stripeEvent.id,
      event_type: mappedEventType,
      provider: 'stripe',
      provider_payment_id: providerPaymentId,
      provider_ref: providerRef,
      amount,
      failure_reason: failureReason,
      metadata: {
        stripe_event_type: eventType,
        stripe_event_id: stripeEvent.id,
        ...(stripeEvent.data.object as { metadata?: Record<string, unknown> }).metadata,
      },
    };
  }
}

