export class EquityLensError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'EquityLensError';
  }
}

export class DataFetchError extends EquityLensError {
  constructor(
    message: string,
    public readonly source: 'yahoo' | 'sec' | 'openrouter',
    public readonly statusCode?: number,
  ) {
    super(message, 'DATA_FETCH_ERROR');
    this.name = 'DataFetchError';
  }
}

export class LLMError extends EquityLensError {
  constructor(
    message: string,
    public readonly modelId: string,
    public readonly retryable: boolean = false,
  ) {
    super(message, 'LLM_ERROR');
    this.name = 'LLMError';
  }
}

export class ValidationError extends EquityLensError {
  constructor(
    message: string,
    public readonly field: string,
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class CacheError extends EquityLensError {
  constructor(message: string) {
    super(message, 'CACHE_ERROR');
    this.name = 'CacheError';
  }
}
