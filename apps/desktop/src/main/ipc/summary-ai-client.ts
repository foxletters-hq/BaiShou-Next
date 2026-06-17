import { generateText } from 'ai'
import { settingsManager } from './settings.ipc'
import {
  GlobalModelsConfig,
  logger,
  prepareProviderConfigForRuntime,
  resolveSummaryConfigFromSettings
} from '@baishou/shared'
import { pathService } from './vault.ipc'
import type { SummaryAiClient } from '@baishou/core-desktop'
import { AIProviderConfig } from '@baishou/shared'
import { AIProviderRegistry } from '@baishou/ai'
import path from 'path'
import fs from 'fs'

/** 写调试日志到 Vault 目录，便于用户排查生成问题 */
async function appendDebugLog(
  vaultPath: string | null,
  data: Record<string, unknown>
): Promise<void> {
  if (!vaultPath) return
  const logFile = path.join(vaultPath, 'summary_generation_debug.log')
  fs.appendFileSync(logFile, JSON.stringify(data) + '\n', 'utf-8')
}

/**
 * 构建摘要 AI 生成客户端。
 * 支持自定义摘要模型覆盖全局默认 Provider。
 */
export function buildSummaryAiClient(): SummaryAiClient {
  return {
    async generateContent(prompt: string, modelId: string): Promise<string> {
      const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
      const resolution = resolveSummaryConfigFromSettings(providers, globalModels, modelId)

      if (!resolution.ok) {
        if (resolution.reason === 'no_api_key') {
          throw new Error(
            `No active provider with API key for summary generation (provider: ${
              resolution.providerName ?? 'unknown'
            })`
          )
        }
        if (resolution.reason === 'no_model') {
          throw new Error('No summary model configured')
        }
        throw new Error('No active AI provider configured for summary generation')
      }

      const { providerConfig, modelId: finalModelId } = resolution
      const registry = AIProviderRegistry.getInstance()
      const finalProvider = registry.getOrUpdateProvider(
        prepareProviderConfigForRuntime(providerConfig)
      )
      const model = finalProvider.getLanguageModel(finalModelId)
      const providerUrl = finalProvider.config?.baseUrl || 'default'
      const activeVaultPath = await pathService.getActiveVaultPath()

      logger.info(
        `[SummaryAI] Starting generation request to model: ${finalModelId} (baseUrl: ${providerUrl}), prompt length: ${prompt.length}`
      )
      await appendDebugLog(activeVaultPath, {
        timestamp: new Date().toISOString(),
        event: 'start',
        providerId: finalProvider.config?.id,
        modelId: finalModelId,
        baseUrl: providerUrl,
        promptLength: prompt.length
      })

      const startTime = Date.now()
      const abortController = new AbortController()

      // 120秒 Promise 级别强制超时，绝对防止任何流挂起
      let timeoutId: ReturnType<typeof setTimeout>
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort()
          const err = new Error(
            'AI generation timed out after 120 seconds (Promise level force-abort).'
          )
          err.name = 'AbortError'
          reject(err)
        }, 120000)
      })

      try {
        logger.info(
          `[SummaryAI] Invoking Vercel AI SDK generateText with 120s Promise-race timeout...`
        )

        const generatePromise = (async () => {
          const { text } = await generateText({
            model,
            prompt,
            maxSteps: 1,
            abortSignal: abortController.signal
          } as any)
          return text
        })()

        const text = await Promise.race([generatePromise, timeoutPromise])
        const duration = Date.now() - startTime

        logger.info(
          `[SummaryAI] generateText request succeeded in ${duration}ms. Response text length: ${text.length} characters.`
        )
        await appendDebugLog(activeVaultPath, {
          timestamp: new Date().toISOString(),
          event: 'success',
          durationMs: duration,
          responseLength: text.length
        })

        return text
      } catch (err: any) {
        const duration = Date.now() - startTime

        if (
          err.name === 'AbortError' ||
          err.message?.includes('aborted') ||
          err.message?.includes('timeout')
        ) {
          logger.error(
            `[SummaryAI] REQUEST TIMED OUT! AI generation request failed in ${duration}ms after exceeding the 120 seconds limit.`
          )
        } else {
          logger.error(
            `[SummaryAI] generateText request failed in ${duration}ms. Error name: ${err.name}, message: ${err.message}`,
            err
          )
        }

        await appendDebugLog(activeVaultPath, {
          timestamp: new Date().toISOString(),
          event: 'error',
          durationMs: duration,
          errorMessage: err.message || String(err),
          errorStack: err.stack || ''
        })
        throw err
      } finally {
        clearTimeout(timeoutId!)
      }
    }
  }
}
