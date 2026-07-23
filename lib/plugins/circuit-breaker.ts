import { logger } from '@/lib/logger';

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  openDurationMs?: number;
}

/**
 * Per-adapter circuit breaker. State is in-memory (resets on cold start —
 * acceptable for serverless).
 */
export class CircuitBreaker {
  private state: State = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly openDuration: number;

  constructor(private readonly name: string, opts: CircuitBreakerOptions = {}) {
    this.threshold = opts.failureThreshold ?? 5;
    this.openDuration = opts.openDurationMs ?? 30_000;
  }

  getState(): State {
    if (this.state === 'OPEN' && Date.now() - this.openedAt >= this.openDuration) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  canAttempt(): boolean {
    return this.getState() !== 'OPEN';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      logger.warn('Circuit opened', { adapter: this.name, failures: this.failures });
    }
  }

  /**
   * Execute primary with automatic fallback. If the circuit is OPEN or primary
   * throws, the fallback is used.
   */
  async execute<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (!this.canAttempt()) {
      return fallback();
    }
    try {
      const result = await primary();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      logger.warn('Adapter primary failed — using fallback', {
        adapter: this.name,
        error: String(err),
      });
      return fallback();
    }
  }
}
