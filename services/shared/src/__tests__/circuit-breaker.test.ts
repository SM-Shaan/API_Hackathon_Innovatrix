import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  CircuitBreakerRegistry,
  retryWithBackoff,
} from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 100,
    });
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow requests when closed', () => {
      expect(breaker.isAllowed()).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute function successfully', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should propagate errors', async () => {
      await expect(
        breaker.execute(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });

    it('should track successful requests', async () => {
      await breaker.execute(async () => 'success');
      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalSuccesses).toBe(1);
    });

    it('should track failed requests', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('test');
        });
      } catch {
        // Expected
      }
      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.totalFailures).toBe(1);
    });
  });

  describe('state transitions', () => {
    it('should open after failure threshold', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject requests when open', async () => {
      breaker.trip();
      await expect(breaker.execute(async () => 'test')).rejects.toThrow(
        CircuitBreakerOpenError
      );
    });

    it('should transition to half-open after timeout', async () => {
      breaker.trip();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next check should allow (and transition to half-open)
      expect(breaker.isAllowed()).toBe(true);
    });

    it('should close after success threshold in half-open', async () => {
      breaker.trip();
      await new Promise(resolve => setTimeout(resolve, 150));

      // Execute successful requests
      await breaker.execute(async () => 'success1');
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      await breaker.execute(async () => 'success2');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should re-open on failure in half-open state', async () => {
      breaker.trip();
      await new Promise(resolve => setTimeout(resolve, 150));

      // First success
      await breaker.execute(async () => 'success');
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Then failure
      try {
        await breaker.execute(async () => {
          throw new Error('fail');
        });
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('executeWithFallback', () => {
    it('should return fallback when circuit is open', async () => {
      breaker.trip();
      const result = await breaker.executeWithFallback(
        async () => 'primary',
        () => 'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('should return primary result when circuit is closed', async () => {
      const result = await breaker.executeWithFallback(
        async () => 'primary',
        () => 'fallback'
      );
      expect(result).toBe('primary');
    });

    it('should propagate non-circuit-breaker errors', async () => {
      await expect(
        breaker.executeWithFallback(
          async () => {
            throw new Error('test error');
          },
          () => 'fallback'
        )
      ).rejects.toThrow('test error');
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      breaker.trip();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      breaker.reset();
      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should clear failure count', async () => {
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('fail');
          });
        } catch {
          // Expected
        }
      }

      breaker.reset();
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  it('should create and return a circuit breaker', () => {
    const breaker = registry.getBreaker('test-service');
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('should return the same breaker for the same name', () => {
    const breaker1 = registry.getBreaker('test-service');
    const breaker2 = registry.getBreaker('test-service');
    expect(breaker1).toBe(breaker2);
  });

  it('should return different breakers for different names', () => {
    const breaker1 = registry.getBreaker('service-1');
    const breaker2 = registry.getBreaker('service-2');
    expect(breaker1).not.toBe(breaker2);
  });

  it('should get all metrics', async () => {
    const breaker1 = registry.getBreaker('service-1');
    const breaker2 = registry.getBreaker('service-2');

    await breaker1.execute(async () => 'test');

    const metrics = registry.getAllMetrics();
    expect(metrics['service-1'].totalRequests).toBe(1);
    expect(metrics['service-2'].totalRequests).toBe(0);
  });

  it('should reset all breakers', () => {
    const breaker1 = registry.getBreaker('service-1');
    const breaker2 = registry.getBreaker('service-2');

    breaker1.trip();
    breaker2.trip();

    registry.resetAll();

    expect(breaker1.getState()).toBe(CircuitState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitState.CLOSED);
  });
});

describe('retryWithBackoff', () => {
  it('should return result on first success', async () => {
    const result = await retryWithBackoff(async () => 'success');
    expect(result).toBe('success');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    const result = await retryWithBackoff(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('retry');
        return 'success';
      },
      { maxRetries: 3, initialDelay: 10 }
    );
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });

  it('should throw after max retries', async () => {
    await expect(
      retryWithBackoff(
        async () => {
          throw new Error('always fail');
        },
        { maxRetries: 2, initialDelay: 10 }
      )
    ).rejects.toThrow('always fail');
  });

  it('should not retry CircuitBreakerOpenError', async () => {
    let attempts = 0;
    await expect(
      retryWithBackoff(
        async () => {
          attempts++;
          throw new CircuitBreakerOpenError('open', {
            state: CircuitState.OPEN,
            failures: 0,
            successes: 0,
            lastFailureTime: null,
            totalRequests: 0,
            totalFailures: 0,
            totalSuccesses: 0,
          });
        },
        { maxRetries: 3, initialDelay: 10 }
      )
    ).rejects.toThrow(CircuitBreakerOpenError);
    expect(attempts).toBe(1);
  });
});
