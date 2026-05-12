import * as crypto from 'node:crypto';
import { StreamTextResult } from 'ai';
import { SessionRepository } from '@baishou/database';
import { logger } from '@baishou/shared';
import { IAIProvider } from '../providers/provider.interface';
import { ModelPricingService } from '../pricing/model-pricing.service';
import { StreamAccumulator } from './stream-accumulator';
// @ts-ignore
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository';

export interface PersistResultParams {
  sessionId: string;
  rawUserText: string;
  streamResult: StreamTextResult<any, any>;
  accumulator: StreamAccumulator;
  sessionRepo: SessionRepository;
  snapshotRepo: SnapshotRepository;
  provider: IAIProvider;
  modelId: string;
  skipUserMessageRecording?: boolean;
  streamError: any;
}

/**
 * 将流结果落盘到数据库。
 * 从 AgentSessionService 中拆出，职责更清晰。
 */
export async function persistResult(params: PersistResultParams): Promise<void> {
  const { sessionId, rawUserText, streamResult, accumulator, sessionRepo, snapshotRepo, provider, modelId, skipUserMessageRecording, streamError } = params;

  // 用户消息已经在 streamChat 开始时保存，这里只需要获取当前的 orderIndex
  const history = await sessionRepo.getMessagesBySession(sessionId, 1);
  const lastOrder = history.length > 0 && history[0] ? history[0].orderIndex : 0;
  let userOrderIndex = lastOrder;

  // 如果是重发/编辑模式，需要计算正确的 orderIndex
  if (skipUserMessageRecording) {
    userOrderIndex = lastOrder;
  }

  // ======== 构建 assistant 消息 Parts ========
  const assistantMsgId = crypto.randomUUID();
  const partsToInsert: any[] = [];

  // 推送文本 Part
  if (accumulator.text) {
    partsToInsert.push({
      id: crypto.randomUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: { text: accumulator.text }
    });
  }

  // 推送推理 Part (如果有)
  if (accumulator.reasoning) {
    partsToInsert.push({
      id: crypto.randomUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'text',
      data: { text: accumulator.reasoning, isReasoning: true }
    });
  }

  // 推送工具 Call & Result Part
  for (const tc of accumulator.toolCalls) {
    const resultObj = accumulator.toolResults.find(tr => tr.callId === tc.callId);
    partsToInsert.push({
      id: crypto.randomUUID(),
      messageId: assistantMsgId,
      sessionId,
      type: 'tool',
      data: {
        callId: tc.callId,
        name: tc.name,
        arguments: tc.arguments,
        result: resultObj ? resultObj.result : undefined,
        status: resultObj ? 'completed' : 'failed'
      }
    });
  }

  // 从 Vercel AI SDK 获取最终 usage
  let finalUsage = { 
    inputTokens: accumulator.usage.inputTokens, 
    outputTokens: accumulator.usage.outputTokens 
  };
  let costMicros = 0;

  if (!streamError) {
    try {
      const u = await streamResult.usage;
      logger.info('[AgentSessionService Debug] streamResult.usage resolved to:', JSON.stringify(u));
      if (u) {
        finalUsage.inputTokens = finalUsage.inputTokens || (u as any).inputTokens || (u as any).promptTokens || 0;
        finalUsage.outputTokens = finalUsage.outputTokens || (u as any).outputTokens || (u as any).completionTokens || 0;
      }
    } catch(e: any) {
      if (e.name === 'AbortError') {
        logger.info('[AgentSessionService Debug] streamResult.usage read gracefully skipped (stream aborted by user).');
      } else {
        logger.warn('[AgentSessionService Debug] Failed to read streamResult.usage:', e);
      }
    }

    // 极端情况兜底：本地量化预估
    if (finalUsage.inputTokens === 0 && finalUsage.outputTokens === 0) {
      try {
        if (accumulator.text.length > 0) {
          const { get_encoding } = require('tiktoken');
          const enc = get_encoding('cl100k_base');
          finalUsage.inputTokens = enc.encode(rawUserText).length;
          finalUsage.outputTokens = enc.encode(accumulator.text + accumulator.reasoning).length;
          enc.free();
          logger.info(`[AgentSessionService] 提示: 接口未返回 Token，已启用本地预估策略!`);
        }
      } catch (e) {
        logger.warn('Fallback tiktoken estimation failed', e);
      }
    }

    // 累加计算 tokens 及账单微美分成本
    costMicros = await ModelPricingService.getInstance().calculateCostMicros(provider.config.id, modelId, finalUsage);
    
    logger.info('\n================== 计费日志 ==================');
    logger.info(`模型: ${modelId} (${provider.config.id})`);
    logger.info(`Tokens消耗: 输入 ${finalUsage.inputTokens} | 输出 ${finalUsage.outputTokens}`);
    logger.info(`本次费用(Micros微美分): ${costMicros} (约合 $${(costMicros / 1000000).toFixed(6)})`);
    if (costMicros === 0) {
      logger.info(`提示: 计算费用为 0。可能模型是免费的，或未能从 models.dev 拉取到该模型价格。`);
    }
    logger.info('==============================================\n');
  } else {
    logger.warn('[AgentSessionService] 流式过程发生错误，使用 Accumulator 中的有限数据落盘。错误:', streamError);
  }

  // 开始事务存放! — 即使流式出错，也将已累积的回复内容落盘，防止消息丢失
  if (partsToInsert.length > 0) {
    await sessionRepo.insertMessageWithParts(
      {
        id: assistantMsgId,
        sessionId,
        role: 'assistant',
        orderIndex: userOrderIndex + 1,
        inputTokens: finalUsage.inputTokens,
        outputTokens: finalUsage.outputTokens,
        costMicros: costMicros,
        providerId: provider.config.id,
        modelId: modelId,
      },
      partsToInsert
    );
  }

  await sessionRepo.updateTokenUsage(
    sessionId,
    finalUsage.inputTokens,
    finalUsage.outputTokens,
    costMicros
  );

  // ==========================================
  // 触发闲置后台服务 (仅在无流错误时执行)
  // ==========================================
  if (!streamError) {
    const { TitleGeneratorService } = await import('./title-generator.service');
    const { ContextCompressorService } = await import('./context-compressor.service');
    
    setTimeout(() => {
      // 检测新对话
      if (userOrderIndex <= 2) {
        TitleGeneratorService.autoTitle(provider, modelId, sessionRepo, sessionId, rawUserText);
      }
      
      // 并行起跳长文压缩归纳检测机
      ContextCompressorService.compress(provider, modelId, sessionRepo, snapshotRepo, sessionId);
    }, 500);
  }
}
