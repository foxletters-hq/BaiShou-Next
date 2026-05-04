import { generateText } from 'ai';
import { IAIProvider } from '../providers/provider.interface';
import { SessionRepository } from '@baishou/database';
import { logger } from '@baishou/shared';

export class TitleGeneratorService {
  /**
   * 利用用户当前选择的强力主对话模型，通过生成 API 去取个好听简短的标题。
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
      const model = provider.getLanguageModel(modelId);

      // 请求产生名字
      // 我们用无系统的生成，只基于短句
      const { text } = await generateText({
        model,
        prompt: `请根据用户的这句话，为这段对话起一个极为简短、直指主题的名称。\n要求：\n1. 不能超过 15 个字符\n2. 不能使用类似“对话名称：”这样的前置说明，直接输出最终的名字字符串\n用户的首句话为：\n"""\n${userTrivialText}\n"""\n请输出标题：`,
        maxTokens: 30, // 限制它长篇大论以免出问题
        temperature: 0.1, // 主打严谨摘要而不是创造力
      });

      const cleanTitle = text.trim();
      
      if (!cleanTitle) return;

      // 提取最新的 Session 数据进行部分替换
      const sessions = await sessionRepo.findAllSessions();
      const currentSession = sessions.find((s: any) => s.id === sessionId);
      
      if (currentSession) {
         await sessionRepo.upsertSession({
           id: sessionId,
           title: cleanTitle,
           vaultName: currentSession.vaultName,
           assistantId: currentSession.assistantId || undefined,
           providerId: currentSession.providerId,
           modelId: currentSession.modelId,
         });
         logger.info(`[AutoTitler] -> Session(${sessionId}) title updated to: ${cleanTitle}`);
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        // Ignored silently, user stopped before title generation could finish
      } else {
        logger.warn('[AutoTitler] Failed to generate title silently.', e.message);
      }
    }
  }
}
