import { IAIProvider } from './types';

export class AIProviderRegistry {
  private providers: Map<string, IAIProvider> = new Map();

  register(providerId: string, provider: IAIProvider): void {
    if (this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} is already registered`);
    }
    this.providers.set(providerId, provider);
  }

  getProvider(providerId: string): IAIProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    return provider;
  }

  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }
}
