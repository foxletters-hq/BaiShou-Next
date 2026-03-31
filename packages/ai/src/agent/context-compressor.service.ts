import { generateText } from 'ai';
import { IAIProvider } from '../providers/provider.interface';
import { SessionRepository } from '@baishou/database';
// @ts-ignore (因为可能还没在 types 中对齐出它的 exports，如果 tsconfig 发现不了问题则忽略)
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository';
// @ts-ignore
import { MessageWithParts, MessageAdapter } from './message.adapter';

export class ContextCompressorService {
  /**
   * 当历史记录过长（如超过 30 轮以上未压缩）时，
   * 脱机调优主算力去总结这过往的闲聊并产生强记忆 Snapshot 留存。
   */
  static async compress(
    provider: IAIProvider,
    modelId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    sessionId: string
  ): Promise<void> {
    try {
      const model = provider.getLanguageModel(modelId);
      
      const allMessages = await sessionRepo.getMessagesBySession(sessionId, 500) as MessageWithParts[];
      if (allMessages.length < 10) return; // 轮数太少不值得启动大作

      const latestSnapshot = await snapshotRepo.getLatestSnapshot(sessionId);
      
      const startOrderIndex = latestSnapshot ? latestSnapshot.coveredUpToMessageId : -1;
      
      // 我们提取从上次压缩点一直到现在的消息集合（不包括最后刚说的两句，留一些尾巴作为当前环境）
      const safeBufferMessages = allMessages.slice(0, allMessages.length - 2); 
      
      const uncompressedChunk = safeBufferMessages.filter(m => m.orderIndex > startOrderIndex);
      
      if (uncompressedChunk.length < 10) return; // 新轮次积累不满 10 句话，省算力，下次再说！

      const coreMessages = MessageAdapter.toVercelMessages(uncompressedChunk);

      const oldSummary = latestSnapshot ? `旧有的前情提要为：\n${latestSnapshot.summaryText}\n\n` : '';

      // 大工作量的重计算摘要 (耗时可达几十秒)，由 Vercel AI SDK 和主模型完成
      const { text, usage } = await generateText({
         model,
         system: `你是一个记忆压缩与提纯大师。\n你的任务是仔细翻阅以下提供的大段对话历史脉络，并给出精简化、知识化的总结，提取重要的事实依据（比如对方提到的人名地名代码等），抛弃没有用的长篇废话。注意，提取的结果应该精炼紧凑，不能随意缩水重要的上下文环节，它将作为你长程记忆的新载体。\n\n${oldSummary}请输出总结后的合并内容。`,
         messages: coreMessages,
         temperature: 0.1,
      });

      if (!text) return;

      const coveredLastMsg = uncompressedChunk[uncompressedChunk.length - 1]!;
      
      await snapshotRepo.appendSnapshot({
         sessionId: sessionId as any,
         summaryText: text,
         coveredUpToMessageId: coveredLastMsg.orderIndex,
         messageCount: latestSnapshot ? latestSnapshot.messageCount + uncompressedChunk.length : uncompressedChunk.length,
         tokenCount: latestSnapshot ? latestSnapshot.tokenCount + (usage.completionTokens ?? 0) : (usage.completionTokens ?? 0)
      });
      
      // ============================================
      // 物理级死重剥离 (Pruning Blade)
      // 清空长达上万字的网页内容和历史长日志
      // ============================================
      const partsToPrune: string[] = [];
      const PRUNE_THRESHOLD = 800; // 字数超过这个界限的工具输出将被视为过期污染源

      for (const msg of uncompressedChunk) {
        if (msg.role === 'tool' && msg.parts) {
          for (const p of msg.parts) {
            if (p.type === 'tool') {
               const data = p.data as any;
               if (typeof data?.result === 'string' && data.result.length > PRUNE_THRESHOLD) {
                  partsToPrune.push(p.id);
               }
            } else if (p.type === 'text') {
               const data = p.data as any;
               if (typeof data?.text === 'string' && data.text.length > PRUNE_THRESHOLD) {
                  partsToPrune.push(p.id);
               }
            }
          }
        }
      }

      if (partsToPrune.length > 0) {
        try {
           await (sessionRepo as any).updatePartsDataFallback(partsToPrune, { text: '[工具输出过长，已在后台压缩池中安全剥离]' });
           console.log(`[ContextCompressor] -> Physically pruned ${partsToPrune.length} heavy tool outputs.`);
        } catch(e) { }
      }

      console.log(`[ContextCompressor] -> Silently generated deep memory snapshot for Session(${sessionId})! Token usage: ${usage.totalTokens}`);

    } catch (e: any) {
      console.error('[ContextCompressor] Compression job failed in background:', e.message);
    }
  }
}
