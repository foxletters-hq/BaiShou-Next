export class AIProviderInitializationError extends Error {
  constructor(public readonly providerId: string, message: string) {
    super(`[${providerId}] Initialization failed: ${message}`);
    this.name = 'AIProviderInitializationError';
  }
}

export class AIModelNotSupportedError extends Error {
  constructor(public readonly providerId: string, public readonly modelId: string) {
    super(`Model '${modelId}' is not supported by provider '${providerId}'`);
    this.name = 'AIModelNotSupportedError';
  }
}
