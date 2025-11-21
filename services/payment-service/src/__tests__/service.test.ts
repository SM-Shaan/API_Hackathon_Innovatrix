import { PaymentService } from '../service';
import { PaymentState } from '../state-machine';

// Mock dependencies
const mockRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByPledgeId: jest.fn(),
  findByIdempotencyKey: jest.fn(),
  findByProviderPaymentId: jest.fn(),
  findAll: jest.fn(),
  updateState: jest.fn(),
  saveWebhookEvent: jest.fn(),
  findWebhookByWebhookId: jest.fn(),
  markWebhookProcessed: jest.fn(),
  getTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
};

const mockIdempotencyService = {
  checkWebhook: jest.fn(),
  markWebhookProcessed: jest.fn(),
  checkAndProcess: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
  subscribe: jest.fn(),
  start: jest.fn(),
  close: jest.fn(),
};

const mockPool = {};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.getTransaction.mockResolvedValue(mockClient);
    mockRepository.commitTransaction.mockResolvedValue(undefined);
    mockRepository.rollbackTransaction.mockResolvedValue(undefined);

    paymentService = new PaymentService(
      mockRepository as any,
      mockIdempotencyService as any,
      mockEventBus as any,
      mockPool as any,
      mockLogger as any
    );
  });

  describe('initiatePayment', () => {
    it('should create new payment when idempotency key is new', async () => {
      const paymentDto = {
        pledge_id: 'pledge-123',
        amount: 100,
        idempotency_key: 'key-123',
      };

      const createdPayment = {
        id: 'payment-456',
        ...paymentDto,
        state: PaymentState.PENDING,
        currency: 'USD',
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(createdPayment);

      const result = await paymentService.initiatePayment(paymentDto);

      expect(result.wasIdempotent).toBe(false);
      expect(result.payment).toEqual(createdPayment);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment.created',
          aggregateType: 'payment',
          aggregateId: 'payment-456',
        })
      );
    });

    it('should return existing payment when idempotency key exists', async () => {
      const existingPayment = {
        id: 'payment-456',
        pledge_id: 'pledge-123',
        amount: 100,
        state: PaymentState.PENDING,
        idempotency_key: 'key-123',
      };

      mockRepository.findByIdempotencyKey.mockResolvedValue(existingPayment);

      const result = await paymentService.initiatePayment({
        pledge_id: 'pledge-123',
        amount: 100,
        idempotency_key: 'key-123',
      });

      expect(result.wasIdempotent).toBe(true);
      expect(result.payment).toEqual(existingPayment);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    const basePayment = {
      id: 'payment-456',
      pledge_id: 'pledge-123',
      amount: 100,
      state: PaymentState.PENDING,
      provider_payment_id: 'pi_123',
    };

    it('should process valid forward state transition', async () => {
      const webhookPayload = {
        webhook_id: 'wh-123',
        event_type: 'payment_intent.authorized',
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      };

      const updatedPayment = {
        ...basePayment,
        state: PaymentState.AUTHORIZED,
      };

      mockRepository.findWebhookByWebhookId.mockResolvedValue(null);
      mockRepository.findByProviderPaymentId.mockResolvedValue(basePayment);
      mockRepository.saveWebhookEvent.mockResolvedValue({});
      mockRepository.updateState.mockResolvedValue(updatedPayment);
      mockRepository.markWebhookProcessed.mockResolvedValue(undefined);

      const result = await paymentService.processWebhook(webhookPayload);

      expect(result.payment.state).toBe(PaymentState.AUTHORIZED);
      expect(result.wasIdempotent).toBe(false);
      expect(result.transitionResult?.allowed).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'payment.authorized',
        })
      );
    });

    it('should reject backward state transition', async () => {
      const webhookPayload = {
        webhook_id: 'wh-456',
        event_type: 'payment_intent.authorized', // Trying to go back to AUTHORIZED
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      };

      const capturedPayment = {
        ...basePayment,
        state: PaymentState.CAPTURED, // Already CAPTURED
      };

      mockRepository.findWebhookByWebhookId.mockResolvedValue(null);
      mockRepository.findByProviderPaymentId.mockResolvedValue(capturedPayment);
      mockRepository.saveWebhookEvent.mockResolvedValue({});
      mockRepository.markWebhookProcessed.mockResolvedValue(undefined);

      const result = await paymentService.processWebhook(webhookPayload);

      // Payment state should NOT change
      expect(result.payment.state).toBe(PaymentState.CAPTURED);
      expect(result.transitionResult?.allowed).toBe(false);
      expect(result.transitionResult?.reason).toContain('Backward transition not allowed');
      // updateState should NOT be called for backward transitions
      expect(mockRepository.updateState).not.toHaveBeenCalled();
    });

    it('should handle duplicate webhook idempotently', async () => {
      const webhookPayload = {
        webhook_id: 'wh-123',
        event_type: 'payment_intent.authorized',
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      };

      const processedWebhook = {
        webhook_id: 'wh-123',
        payment_id: 'payment-456',
        processed: true,
      };

      mockRepository.findWebhookByWebhookId.mockResolvedValue(processedWebhook);
      mockRepository.findById.mockResolvedValue(basePayment);

      const result = await paymentService.processWebhook(webhookPayload);

      expect(result.wasIdempotent).toBe(true);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'webhook.duplicate',
        })
      );
    });

    it('should handle complete payment flow', async () => {
      // Test the full flow: PENDING -> AUTHORIZED -> CAPTURED -> COMPLETED

      let currentPayment = { ...basePayment, state: PaymentState.PENDING };

      mockRepository.findWebhookByWebhookId.mockResolvedValue(null);
      mockRepository.findByProviderPaymentId.mockResolvedValue(currentPayment);
      mockRepository.saveWebhookEvent.mockResolvedValue({});
      mockRepository.markWebhookProcessed.mockResolvedValue(undefined);

      // Step 1: PENDING -> AUTHORIZED
      mockRepository.updateState.mockResolvedValue({
        ...currentPayment,
        state: PaymentState.AUTHORIZED,
      });

      let result = await paymentService.processWebhook({
        webhook_id: 'wh-1',
        event_type: 'payment_intent.authorized',
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      });

      expect(result.payment.state).toBe(PaymentState.AUTHORIZED);
      currentPayment = result.payment;
      mockRepository.findByProviderPaymentId.mockResolvedValue(currentPayment);

      // Step 2: AUTHORIZED -> CAPTURED
      mockRepository.updateState.mockResolvedValue({
        ...currentPayment,
        state: PaymentState.CAPTURED,
      });

      result = await paymentService.processWebhook({
        webhook_id: 'wh-2',
        event_type: 'payment_intent.captured',
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      });

      expect(result.payment.state).toBe(PaymentState.CAPTURED);
      currentPayment = result.payment;
      mockRepository.findByProviderPaymentId.mockResolvedValue(currentPayment);

      // Step 3: CAPTURED -> COMPLETED
      mockRepository.updateState.mockResolvedValue({
        ...currentPayment,
        state: PaymentState.COMPLETED,
      });

      result = await paymentService.processWebhook({
        webhook_id: 'wh-3',
        event_type: 'payment_intent.succeeded',
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      });

      expect(result.payment.state).toBe(PaymentState.COMPLETED);
    });

    it('should handle out-of-order webhooks correctly', async () => {
      // Scenario: CAPTURED webhook arrives before AUTHORIZED webhook
      // This should be rejected as it's an invalid skip

      const pendingPayment = { ...basePayment, state: PaymentState.PENDING };

      mockRepository.findWebhookByWebhookId.mockResolvedValue(null);
      mockRepository.findByProviderPaymentId.mockResolvedValue(pendingPayment);
      mockRepository.saveWebhookEvent.mockResolvedValue({});
      mockRepository.markWebhookProcessed.mockResolvedValue(undefined);

      const result = await paymentService.processWebhook({
        webhook_id: 'wh-ooo',
        event_type: 'payment_intent.captured', // Trying to skip AUTHORIZED
        provider: 'stripe',
        provider_payment_id: 'pi_123',
      });

      // Should reject the transition
      expect(result.transitionResult?.allowed).toBe(false);
      expect(result.payment.state).toBe(PaymentState.PENDING); // State unchanged
    });
  });

  describe('transitionState', () => {
    it('should allow valid manual state transition', async () => {
      const payment = {
        id: 'payment-456',
        pledge_id: 'pledge-123',
        state: PaymentState.CAPTURED,
      };

      mockRepository.findById.mockResolvedValue(payment);
      mockRepository.updateState.mockResolvedValue({
        ...payment,
        state: PaymentState.COMPLETED,
      });

      const result = await paymentService.transitionState(
        'payment-456',
        PaymentState.COMPLETED
      );

      expect(result.transitionResult?.allowed).toBe(true);
      expect(result.payment.state).toBe(PaymentState.COMPLETED);
    });

    it('should reject invalid manual state transition', async () => {
      const payment = {
        id: 'payment-456',
        pledge_id: 'pledge-123',
        state: PaymentState.COMPLETED,
      };

      mockRepository.findById.mockResolvedValue(payment);

      const result = await paymentService.transitionState(
        'payment-456',
        PaymentState.PENDING
      );

      expect(result.transitionResult?.allowed).toBe(false);
      expect(mockRepository.updateState).not.toHaveBeenCalled();
    });
  });
});
