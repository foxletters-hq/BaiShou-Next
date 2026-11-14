import { wrapLanguageModel, type LanguageModel } from 'ai'
import type { LanguageModelV3Middleware } from '@ai-sdk/provider'

export interface GoogleSafetySetting {
  category:
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT'
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  threshold: 'BLOCK_NONE'
}

/**
 * 关闭 Google Gemini / Vertex AI 默认内容审查拦截：
 * 仅覆盖全模型与中转网关通用支持的 4 个核心安全分类，避免传入部分模型不支持的
 * `HARM_CATEGORY_CIVIC_INTEGRITY` 导致 400 INVALID_ARGUMENT。
 */
export const GOOGLE_PERMISSIVE_SAFETY_SETTINGS: readonly GoogleSafetySetting[] = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
]

export function createGooglePermissiveSafetyMiddleware(): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3' as const,
    transformParams: async ({ params }) => {
      const existingProviderOptions =
        (params.providerOptions as Record<string, unknown> | undefined) ?? {}
      const existingGoogleOptions =
        (existingProviderOptions.google as Record<string, unknown> | undefined) ?? {}

      if (existingGoogleOptions.safetySettings !== undefined) {
        return params
      }

      return {
        ...params,
        providerOptions: {
          ...existingProviderOptions,
          google: {
            ...existingGoogleOptions,
            safetySettings: GOOGLE_PERMISSIVE_SAFETY_SETTINGS.map((item) => ({ ...item }))
          }
        }
      } as typeof params
    }
  }
}

/**
 * 为 Google（Gemini / Vertex AI）语言模型统一注入最低安全过滤阈值（BLOCK_NONE）。
 * 挂在 Provider 出口处，确保主对话、摘要、OCR、图谱抽取、连接测试等所有调用路径一致生效。
 */
export function wrapGoogleLanguageModelWithSafetySettings(model: LanguageModel): LanguageModel {
  if (typeof wrapLanguageModel !== 'function') {
    return model
  }
  return wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]['model'],
    middleware: createGooglePermissiveSafetyMiddleware() as never
  }) as unknown as LanguageModel
}
