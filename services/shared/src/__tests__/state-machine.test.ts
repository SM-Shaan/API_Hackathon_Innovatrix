import { PaymentStateMachine, PaymentState } from '../state-machine';

describe('PaymentStateMachine', () => {
  describe('canTransition', () => {
    it('should allow PENDING to AUTHORIZED', () => {
      const result = PaymentStateMachine.canTransition(
        PaymentState.PENDING,
        PaymentState.AUTHORIZED
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow AUTHORIZED to CAPTURED', () => {
      const result = PaymentStateMachine.canTransition(
        PaymentState.AUTHORIZED,
        PaymentState.CAPTURED
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow CAPTURED to COMPLETED', () => {
      const result = PaymentStateMachine.canTransition(
        PaymentState.CAPTURED,
        PaymentState.COMPLETED
      );
      expect(result.allowed).toBe(true);
    });

    it('should allow any state to FAILED', () => {
      expect(
        PaymentStateMachine.canTransition(PaymentState.PENDING, PaymentState.FAILED).allowed
      ).toBe(true);
      expect(
        PaymentStateMachine.canTransition(PaymentState.AUTHORIZED, PaymentState.FAILED).allowed
      ).toBe(true);
      expect(
        PaymentStateMachine.canTransition(PaymentState.CAPTURED, PaymentState.FAILED).allowed
      ).toBe(true);
    });

    it('should NOT allow backward transitions', () => {
      // CAPTURED -> AUTHORIZED (backward)
      const result1 = PaymentStateMachine.canTransition(
        PaymentState.CAPTURED,
        PaymentState.AUTHORIZED
      );
      expect(result1.allowed).toBe(false);
      expect(result1.reason).toContain('Backward transition not allowed');

      // COMPLETED -> CAPTURED (backward)
      const result2 = PaymentStateMachine.canTransition(
        PaymentState.COMPLETED,
        PaymentState.CAPTURED
      );
      expect(result2.allowed).toBe(false);

      // AUTHORIZED -> PENDING (backward)
      const result3 = PaymentStateMachine.canTransition(
        PaymentState.AUTHORIZED,
        PaymentState.PENDING
      );
      expect(result3.allowed).toBe(false);
    });

    it('should NOT allow transitions from terminal states', () => {
      const result1 = PaymentStateMachine.canTransition(
        PaymentState.COMPLETED,
        PaymentState.AUTHORIZED
      );
      expect(result1.allowed).toBe(false);

      const result2 = PaymentStateMachine.canTransition(
        PaymentState.FAILED,
        PaymentState.PENDING
      );
      expect(result2.allowed).toBe(false);
    });

    it('should allow same state transition (idempotent)', () => {
      const result = PaymentStateMachine.canTransition(
        PaymentState.AUTHORIZED,
        PaymentState.AUTHORIZED
      );
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Already in this state');
    });

    it('should NOT allow skipping states', () => {
      // PENDING -> CAPTURED (skipping AUTHORIZED)
      const result = PaymentStateMachine.canTransition(
        PaymentState.PENDING,
        PaymentState.CAPTURED
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for COMPLETED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.COMPLETED)).toBe(true);
    });

    it('should return true for FAILED', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.FAILED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(PaymentStateMachine.isTerminalState(PaymentState.PENDING)).toBe(false);
      expect(PaymentStateMachine.isTerminalState(PaymentState.AUTHORIZED)).toBe(false);
      expect(PaymentStateMachine.isTerminalState(PaymentState.CAPTURED)).toBe(false);
    });
  });

  describe('getNextValidStates', () => {
    it('should return correct next states for PENDING', () => {
      const nextStates = PaymentStateMachine.getNextValidStates(PaymentState.PENDING);
      expect(nextStates).toContain(PaymentState.AUTHORIZED);
      expect(nextStates).toContain(PaymentState.FAILED);
      expect(nextStates).not.toContain(PaymentState.CAPTURED);
    });

    it('should return empty array for terminal states', () => {
      expect(PaymentStateMachine.getNextValidStates(PaymentState.COMPLETED)).toEqual([]);
      expect(PaymentStateMachine.getNextValidStates(PaymentState.FAILED)).toEqual([]);
    });
  });
});
