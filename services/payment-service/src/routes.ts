import { Router, Request, Response } from 'express';
import { PaymentService } from './service';
import { PaymentState, PaymentStateMachine } from './state-machine';
import { Logger } from './logger';

export const createPaymentRoutes = (paymentService: PaymentService, logger: Logger) => {
  const router = Router();

  /**
   * POST /api/payments
   * Initiate a new payment
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { pledge_id, amount, currency, idempotency_key, donor_email, campaign_id } = req.body;

      if (!pledge_id || !amount || !idempotency_key) {
        return res.status(400).json({
          error: 'pledge_id, amount, and idempotency_key are required',
        });
      }

      if (amount <= 0) {
        return res.status(400).json({ error: 'Amount must be positive' });
      }

      const result = await paymentService.initiatePayment({
        pledge_id,
        amount,
        currency,
        idempotency_key,
        donor_email,
        campaign_id,
      });

      // Return 200 if idempotent (already exists), 201 if new
      const statusCode = result.wasIdempotent ? 200 : 201;
      res.status(statusCode).json({
        payment: result.payment,
        wasIdempotent: result.wasIdempotent,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to initiate payment');
      const message = error instanceof Error ? error.message : 'Failed to initiate payment';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/payments/webhook
   * Handle payment provider webhooks
   * This endpoint is critical for idempotency and state machine
   */
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const {
        webhook_id,
        event_type,
        provider,
        provider_payment_id,
        provider_ref,
        amount,
        failure_reason,
        metadata,
      } = req.body;

      // Validate required webhook fields
      if (!webhook_id || !event_type || !provider_payment_id) {
        return res.status(400).json({
          error: 'webhook_id, event_type, and provider_payment_id are required',
        });
      }

      const result = await paymentService.processWebhook({
        webhook_id,
        event_type,
        provider: provider || 'stripe',
        provider_payment_id,
        provider_ref,
        amount,
        failure_reason,
        metadata,
      });

      // Always return 200 to acknowledge webhook receipt
      // This prevents the provider from retrying
      res.status(200).json({
        success: true,
        payment: result.payment,
        wasIdempotent: result.wasIdempotent,
        transitionResult: result.transitionResult,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to process webhook');

      // Still return 200 for idempotency errors to prevent retry loops
      if (error instanceof Error && error.message.includes('already processed')) {
        return res.status(200).json({
          success: true,
          wasIdempotent: true,
          message: error.message,
        });
      }

      const message = error instanceof Error ? error.message : 'Failed to process webhook';
      res.status(400).json({ error: message });
    }
  });

  /**
   * GET /api/payments/:id
   * Get payment by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const payment = await paymentService.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      res.json(payment);
    } catch (error) {
      logger.error({ error }, 'Failed to get payment');
      res.status(500).json({ error: 'Failed to get payment' });
    }
  });

  /**
   * GET /api/payments/pledge/:pledgeId
   * Get payment by pledge ID
   */
  router.get('/pledge/:pledgeId', async (req: Request, res: Response) => {
    try {
      const payment = await paymentService.getPaymentByPledge(req.params.pledgeId);
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found for this pledge' });
      }
      res.json(payment);
    } catch (error) {
      logger.error({ error }, 'Failed to get payment by pledge');
      res.status(500).json({ error: 'Failed to get payment' });
    }
  });

  /**
   * GET /api/payments
   * Get all payments with optional filters
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const state = req.query.state as PaymentState | undefined;
      const pledgeId = req.query.pledgeId as string | undefined;

      const payments = await paymentService.getAllPayments({ state, pledgeId });
      res.json(payments);
    } catch (error) {
      logger.error({ error }, 'Failed to get payments');
      res.status(500).json({ error: 'Failed to get payments' });
    }
  });

  /**
   * POST /api/payments/:id/transition
   * Manually transition payment state (admin use)
   */
  router.post('/:id/transition', async (req: Request, res: Response) => {
    try {
      const { state, reason } = req.body;

      if (!state) {
        return res.status(400).json({ error: 'Target state is required' });
      }

      // Validate state
      if (!Object.values(PaymentState).includes(state)) {
        return res.status(400).json({
          error: `Invalid state. Valid states: ${Object.values(PaymentState).join(', ')}`,
        });
      }

      const result = await paymentService.transitionState(req.params.id, state, reason);

      if (!result.transitionResult?.allowed) {
        return res.status(400).json({
          error: 'State transition not allowed',
          reason: result.transitionResult?.reason,
          currentState: result.payment.state,
          requestedState: state,
        });
      }

      res.json({
        payment: result.payment,
        transitionResult: result.transitionResult,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to transition payment state');
      const message = error instanceof Error ? error.message : 'Failed to transition state';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/payments/:id/simulate/authorize
   * Simulate payment authorization (for demo/testing)
   */
  router.post('/:id/simulate/authorize', async (req: Request, res: Response) => {
    try {
      const payment = await paymentService.simulateProviderAuthorization(req.params.id);
      res.json({ payment, message: 'Payment authorized (simulated)' });
    } catch (error) {
      logger.error({ error }, 'Failed to simulate authorization');
      const message = error instanceof Error ? error.message : 'Failed to simulate';
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/payments/state-machine/info
   * Get state machine information
   */
  router.get('/state-machine/info', async (_req: Request, res: Response) => {
    try {
      const states = Object.values(PaymentState);
      const transitions: Record<string, string[]> = {};

      for (const state of states) {
        transitions[state] = PaymentStateMachine.getNextValidStates(state);
      }

      res.json({
        states,
        transitions,
        terminalStates: states.filter(s => PaymentStateMachine.isTerminalState(s)),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get state machine info' });
    }
  });

  return router;
};
