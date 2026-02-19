/**
 * RetryPolicy - Configurable retry logic for API requests
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

export class RetryPolicy {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      ...config,
    };
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.config.initialDelay;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.shouldRetry(error, attempt)) {
          throw lastError;
        }

        console.warn(`[RetryPolicy] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await this.delay(delay);
        delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) return false;

    // Check if error has a status code we should retry
    if (error instanceof Error && 'status' in error) {
      const status = (error as any).status;
      return this.config.retryableStatusCodes.includes(status);
    }

    // Retry on network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }

    // Default: retry on any error
    return true;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public setConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): RetryConfig {
    return { ...this.config };
  }
}

export default RetryPolicy;
