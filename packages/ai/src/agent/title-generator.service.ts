import { generateText } from 'ai'
import { IAIProvider } from '../providers/provider.interface'
import { SessionRepository } from '@baishou/database'
import { deriveSessionTitleFromUserText, logger } from '@baishou/shared'
import { wrapLanguageModelWithMiddlewares } from '../middleware/middleware-factory'

export class TitleGeneratorService {
  static onTitleUpdated?: (sessionId: string, newTitle: string) => Promise<void> | void

  private static async commitSessionTitle(
    sessionRepo: SessionRepository,
    sessionId: string,
    cleanTitle: string
  ): Promise<void> {
    const sessions = await sessionRepo.findAllSessions()
    const currentSession = sessions.find((s: { id: string }) => s.id === sessionId)
    if (!currentSession) return

    await sessionRepo.upsertSession({
      id: sessionId,
      title: cleanTitle,
      vaultName: currentSession.vaultName,
      assistantId: currentSession.assistantId || undefined,
      providerId: currentSession.providerId,
      modelId: currentSession.modelId
    })
    logger.info(`[AutoTitler] -> Session(${sessionId}) title updated to: ${cleanTitle}`)
    if (TitleGeneratorService.onTitleUpdated) {
      try {
        await TitleGeneratorService.onTitleUpdated(sessionId, cleanTitle)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.warn('[AutoTitler] onTitleUpdated callback failed:', msg)
      }
    }
  }

  /** 未配置命名模型时：直接截取用户首条消息作为标题 */
  static async applyTitleFromUserText(
    sessionRepo: SessionRepository,
    sessionId: string,
    userText: string
  ): Promise<void> {
    const cleanTitle = deriveSessionTitleFromUserText(userText)
    if (!cleanTitle) return

    try {
      await TitleGeneratorService.commitSessionTitle(sessionRepo, sessionId, cleanTitle)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.warn('[AutoTitler] Failed to apply user-text title silently.', msg)
    }
  }

  /**
   * 利用命名模型通过生成 API 生成简短标题。
   * 完全脱机，不阻塞主会话流返回值。
   */
  static async autoTitle(
    provider: IAIProvider,
    modelId: string,
    sessionRepo: SessionRepository,
    sessionId: string,
    userTrivialText: string
  ): Promise<void> {
    try {
      const baseModel = provider.getLanguageModel(modelId)
      const model = wrapLanguageModelWithMiddlewares(baseModel, {
        providerType: provider.config?.type || 'openai',
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      })

      // 请求产生名字
      // 我们用无系统的生成，只基于短句
      const { text } = await generateText({
        model,
        prompt: `请根据用户的这句话，为这段对话起一个极为简短、直指主题的名称。\n要求：\n1. 不能超过 15 个字符\n2. 不能使用类似“对话名称：”这样的前置说明，直接输出最终的名字字符串\n用户的首句话为：\n"""\n${userTrivialText}\n"""\n请输出标题：`,
        temperature: 0.1 // 主打严谨摘要而不是创造力
      })

      const cleanTitle = text.trim()
      if (!cleanTitle) return

      await TitleGeneratorService.commitSessionTitle(sessionRepo, sessionId, cleanTitle)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        return
      }
      const msg = e instanceof Error ? e.message : String(e)
      logger.warn('[AutoTitler] Failed to generate title silently.', msg)
    }
  }

  static async maybeUpdateSessionTitle(params: {
    sessionRepo: SessionRepository
    sessionId: string
    userText: string
    namingModelConfigured?: boolean
    namingProvider?: IAIProvider
    namingModelId?: string
  }): Promise<void> {
    const {
      sessionRepo,
      sessionId,
      userText,
      namingModelConfigured,
      namingProvider,
      namingModelId
    } = params

    if (namingModelConfigured && namingProvider && namingModelId) {
      await TitleGeneratorService.autoTitle(
        namingProvider,
        namingModelId,
        sessionRepo,
        sessionId,
        userText
      )
      return
    }

    await TitleGeneratorService.applyTitleFromUserText(sessionRepo, sessionId, userText)
  }
}
