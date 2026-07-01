import { generateText, type EmbeddingModel, type LanguageModel } from 'ai'
import {
  type AiProviderModel,
  isChatModelForConnectionTest,
  ProviderType
} from '@baishou/shared'
import { IAIProvider } from '../provider.interface'
import { assertAsciiApiKey } from '../fetch-header.util'
import { getRotatedApiKey } from '../provider.utils'
import { extractApiErrorMessage, formatModelNotAvailableMessage } from '../provider-api-error.util'
import { OPENCODE_GO_DEFAULT_DIALOGUE_MODEL } from './opencodego.constants'
import { createOpenCodeGoLanguageModel } from './opencodego.language-model.factory'
import { fetchOpenCodeGoModelIds } from './opencodego.models-client'

export class OpenCodeGoAdaptedProvider implements IAIProvider {
  public config: AiProviderModel

  constructor(config: AiProviderModel) {
    this.config = { ...config, type: ProviderType.OpenCodeGo }
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel =
      modelId || this.config.defaultDialogueModel || OPENCODE_GO_DEFAULT_DIALOGUE_MODEL
    return createOpenCodeGoLanguageModel(this.config, targetModel)
  }

  getEmbeddingModel(_modelId?: string): EmbeddingModel {
    throw new Error('OpenCode Go does not provide embedding models')
  }

  async fetchAvailableModels(): Promise<string[]> {
    return fetchOpenCodeGoModelIds(this.config)
  }

  private filterChatModels(modelIds: string[]): string[] {
    return modelIds.filter((id) => isChatModelForConnectionTest(id))
  }

  private async resolveTestModelId(testModelId?: string): Promise<string> {
    const selected = testModelId?.trim()
    if (!selected) {
      throw new Error('No chat model selected for connection test.')
    }

    if (!isChatModelForConnectionTest(selected)) {
      throw new Error(
        `Model "${selected}" is not a chat model (embedding/rerank/TTS cannot be used for connection test). Pick a dialogue model in the test dialog.`
      )
    }

    let liveChatModels: string[] = []
    try {
      liveChatModels = this.filterChatModels(await this.fetchAvailableModels())
    } catch (e) {
      console.warn(`[OpenCodeGoAdaptedProvider] Could not list models for ${this.config.id}:`, e)
    }

    if (liveChatModels.length > 0 && !liveChatModels.includes(selected)) {
      throw new Error(formatModelNotAvailableMessage(this.config.name, selected, liveChatModels))
    }

    return selected
  }

  async testConnection(testModelId?: string): Promise<void> {
    assertAsciiApiKey(getRotatedApiKey(this.config) || this.config.apiKey)

    const modelToTest = await this.resolveTestModelId(testModelId)

    try {
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort('Connection timeout'), 15000)

      await generateText({
        model: this.getLanguageModel(modelToTest),
        prompt: 'test',
        maxOutputTokens: 1,
        abortSignal: abortController.signal
      })

      clearTimeout(timeoutId)
    } catch (e: unknown) {
      console.error(`Test connection error for ${this.config.name}:`, e)
      const detail = extractApiErrorMessage(e)
      const isModelError = /model does not exist|model not found|invalid model/i.test(detail)
      if (isModelError) {
        let suggestions: string[] = []
        try {
          suggestions = this.filterChatModels(await this.fetchAvailableModels())
        } catch {
          // ignore
        }
        throw new Error(
          formatModelNotAvailableMessage(this.config.name, modelToTest, suggestions) +
            (detail ? ` (${detail})` : '')
        )
      }
      throw new Error(`Connection test failed: ${detail}`)
    }
  }
}
