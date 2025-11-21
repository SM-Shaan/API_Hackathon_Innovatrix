import { PaymentState, PaymentStateMachine } from '../state-machine';

describe('PaymentStateMachine', () => {
  describe('canTransition', () => {
    describe('valid forward transitions', () => {
      it('should allow PENDING -> AUTHORIZED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.PENDING,
          PaymentState.AUTHORIZED
        );
        expect(result.allowed).toBe(true);
        expect(result.fromState).toBe(PaymentState.PENDING);
        expect(result.toState).toBe(PaymentState.AUTHORIZED);
      });

      it('should allow AUTHORIZED -> CAPTURED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.AUTHORIZED,
          PaymentState.CAPTURED
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow CAPTURED -> COMPLETED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.CAPTURED,
          PaymentState.COMPLETED
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow COMPLETED -> REFUNDED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.COMPLETED,
          PaymentState.REFUNDED
        );
        expect(result.allowed).toBe(true);
      });
    });

    describe('FAILED transitions', () => {
      it('should allow PENDING -> FAILED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.PENDING,
          PaymentState.FAILED
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow AUTHORIZED -> FAILED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.AUTHORIZED,
          PaymentState.FAILED
        );
        expect(result.allowed).toBe(true);
      });

      it('should allow CAPTURED -> FAILED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.CAPTURED,
          PaymentState.FAILED
        );
        expect(result.allowed).toBe(true);
      });
    });

    describe('backward transitions (should be rejected)', () => {
      it('should reject AUTHORIZED -> PENDING', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.AUTHORIZED,
          PaymentState.PENDING
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Backward transition not allowed');
      });

      it('should reject CAPTURED -> AUTHORIZED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.CAPTURED,
          PaymentState.AUTHORIZED
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Backward transition not allowed');
      });

      it('should reject COMPLETED -> CAPTURED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.COMPLETED,
          PaymentState.CAPTURED
        );
        expect(result.allowed).toBe(false);
      });

      it('should reject COMPLETED -> PENDING', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.COMPLETED,
          PaymentState.PENDING
        );
        expect(result.allowed).toBe(false);
      });
    });

    describe('idempotent transitions (same state)', () => {
      it('should allow PENDING -> PENDING (idempotent)', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.PENDING,
          PaymentState.PENDING
        );
        expect(result.allowed).toBe(true);
        expect(result.reason).toContain('Already in this state');
      });

      it('should allow COMPLETED -> COMPLETED (idempotent)', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.COMPLETED,
          PaymentState.COMPLETED
        );
        expect(result.allowed).toBe(true);
      });
    });

    describe('terminal state transitions', () => {
      it('should reject transitions from FAILED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.FAILED,
          PaymentState.PENDING
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('terminal state');
      });

      it('should reject transitions from REFUNDED', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.REFUNDED,
          PaymentState.COMPLETED
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('terminal state');
      });
    });

    describe('invalid skip transitions', () => {
      it('should reject PENDING -> CAPTURED (skipping AUTHORIZED)', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.PENDING,
          PaymentState.CAPTURED
        );
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain('Invalid transition');
      });

      it('should reject PENDING -> COMPLETED (skipping steps)', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.PENDING,
          PaymentState.COMPLETED
        );
        expect(result.allowed).toBe(false);
      });

      it('should reject AUTHORIZED -> COMPLETED (skipping CAPTURED)', () => {
        const result = PaymentStateMachine.canTransition(
          PaymentState.AUTHORIZED,
          PaymentState.COMPLETED
        );
        expect(result.allowed).toBe(false);
      });
    });
  });

  describe('isTerminalState', () => {
    it('should return true for COMPLETED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.COMPLETED)).toBe(true);
    });

    it('should return true for FAILED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.FAILED)).toBe(true);
    });

    it('should return true for REFUNDED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.REFUNDED)).toBe(true);
    });

    it('should return false for PENDING', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.PENDING)).toBe(false);
    });

    it('should return false for AUTHORIZED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.AUTHORIZED)).toBe(false);
    });

    it('should return false for CAPTURED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.CAPTURED)).toBe(false);
    });
  });

  describe('getNextValidStates', () => {
    it('should return [AUTHORIZED, FAILED] for PENDING', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.PENDING);
      expect(states).toContain(PaymentState.AUTHORIZED);
      expect(states).toContain(PaymentState.FAILED);
      expect(states).toHaveLength(2);
    });

    it('should return [CAPTURED, FAILED] for AUTHORIZED', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.AUTHORIZED);
      expect(states).toContain(PaymentState.CAPTURED);
      expect(states).toContain(PaymentState.FAILED);
      expect(states).toHaveLength(2);
    });

    it('should return [COMPLETED, FAILED] for CAPTURED', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.CAPTURED);
      expect(states).toContain(PaymentState.COMPLETED);
      expect(states).toContain(PaymentState.FAILED);
      expect(states).toHaveLength(2);
    });

    it('should return [REFUNDED] for COMPLETED', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.COMPLETED);
      expect(states).toContain(PaymentState.REFUNDED);
      expect(states).toHaveLength(1);
    });

    it('should return empty array for FAILED', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.FAILED);
      expect(states).toHaveLength(0);
    });

    it('should return empty array for REFUNDED', () => {
      const states = PaymentStateMachine.getNextValidStates(PaymentState.REFUNDED);
      expect(states).toHaveLength(0);
    });
  });
});
