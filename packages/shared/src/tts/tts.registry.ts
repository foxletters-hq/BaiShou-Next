import { TtsProvider } from '../types/tts.types'

export class TtsProviderRegistry {
  private providers = new Map<string, TtsProvider>()

  register(provider: TtsProvider): void {
    this.providers.set(provider.id, provider)
  }

  get(providerId: string): TtsProvider | undefined {
    return this.providers.get(providerId)
  }

  list(): TtsProvider[] {
    return Array.from(this.providers.values())
  }

  findByModel(modelId: string): TtsProvider | undefined {
    return this.list().find((p) => p.supportsModel(modelId))
  }
}
