// Payment State Machine - Prevents backward state transitions

export enum PaymentState {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// State order for comparison (higher = more advanced)
const STATE_ORDER: Record<PaymentState, number> = {
  [PaymentState.PENDING]: 0,
  [PaymentState.AUTHORIZED]: 1,
  [PaymentState.CAPTURED]: 2,
  [PaymentState.COMPLETED]: 3,
  [PaymentState.FAILED]: -1, // Special case - can happen from any non-terminal state
  [PaymentState.REFUNDED]: 4, // Can only happen after COMPLETED
};

// Valid transitions
const VALID_TRANSITIONS: Record<PaymentState, PaymentState[]> = {
  [PaymentState.PENDING]: [PaymentState.AUTHORIZED, PaymentState.FAILED],
  [PaymentState.AUTHORIZED]: [PaymentState.CAPTURED, PaymentState.FAILED],
  [PaymentState.CAPTURED]: [PaymentState.COMPLETED, PaymentState.FAILED],
  [PaymentState.COMPLETED]: [PaymentState.REFUNDED], // Only refund allowed after completion
  [PaymentState.FAILED]: [], // Terminal state
  [PaymentState.REFUNDED]: [], // Terminal state
};

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
  fromState: PaymentState;
  toState: PaymentState;
}

export class PaymentStateMachine {
  static canTransition(from: PaymentState, to: PaymentState): StateTransitionResult {
    // Same state - no transition needed (idempotent)
    if (from === to) {
      return {
        allowed: true,
        fromState: from,
        toState: to,
        reason: 'Already in this state - no action needed',
      };
    }

    // Check if current state is terminal
    if (this.isTerminalState(from) && from !== PaymentState.COMPLETED) {
      return {
        allowed: false,
        reason: `Cannot transition from terminal state: ${from}`,
        fromState: from,
        toState: to,
      };
    }

    // Check if it's a valid transition
    const validNextStates = VALID_TRANSITIONS[from];
    if (!validNextStates.includes(to)) {
      // Check if it's a backward transition
      if (STATE_ORDER[to] < STATE_ORDER[from] && to !== PaymentState.FAILED) {
        return {
          allowed: false,
          reason: `Backward transition not allowed: ${from} -> ${to}. This prevents out-of-order webhook processing.`,
          fromState: from,
          toState: to,
        };
      }
      return {
        allowed: false,
        reason: `Invalid transition: ${from} -> ${to}. Valid transitions from ${from}: ${validNextStates.join(', ') || 'none'}`,
        fromState: from,
        toState: to,
      };
    }

    return {
      allowed: true,
      fromState: from,
      toState: to,
    };
  }

  static isTerminalState(state: PaymentState): boolean {
    return state === PaymentState.COMPLETED ||
           state === PaymentState.FAILED ||
           state === PaymentState.REFUNDED;
  }

  static getNextValidStates(currentState: PaymentState): PaymentState[] {
    return VALID_TRANSITIONS[currentState];
  }

  static getStateOrder(state: PaymentState): number {
    return STATE_ORDER[state];
  }
}
