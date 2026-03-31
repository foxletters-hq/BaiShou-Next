import { AgentMessage, AgentPart } from '@baishou/shared';
import { SessionRepository } from '@baishou/database';
// @ts-ignore
import { SnapshotRepository, Snapshot } from '@baishou/database/src/repositories/snapshot.repository';

export interface ContextWindowConfig {
  /** 提取最近的对话轮数，包含 user、assistant 等，0 表示尽量不截断（除了走 Snapshot 之外） */
  recentCount: number;
}

export interface MessageWithParts extends AgentMessage {
  parts: AgentPart[];
}

export class ContextWindowBuilder {
  /**
   * 从数据库安全构建将发送给 LLM 的窗口消息列表
   * 包含：
   * 1. 最近的压缩历史挂载于 System 首条
   * 2. 滑动窗口尾随保留
   * 3. 安全退行以保证没有孤立 ToolCall/Result 悬挂
   */
  static async build(
    sessionId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    config: ContextWindowConfig = { recentCount: 30 }
  ): Promise<MessageWithParts[]> {
    
    // 拿大范围或者拿全部。因历史库非常长可能卡顿我们用极值限制一下
    // 注意 getMessagesBySession 内部倒序取并 reverse 原样返还，所以它是从旧到新的
    const rawMessages = await sessionRepo.getMessagesBySession(sessionId, 500) as MessageWithParts[];
    if (rawMessages.length === 0) return [];

    let effectiveMessages: MessageWithParts[] = [];
    
    // 1. 挂接记忆 Snapshot 快照
    const snapshot = await snapshotRepo.getLatestSnapshot(sessionId);
    if (snapshot) {
      // 在旧架构里 coveredUpToMessageId 其实在 Next 里我们通过 OrderIndex 对接
      const cutoffIndex = rawMessages.findIndex(m => m.orderIndex === snapshot.coveredUpToMessageId);

      if (cutoffIndex >= 0 && cutoffIndex < rawMessages.length - 1) {
        // 创建一条伪善的系统快照信息
        const summaryMsg: MessageWithParts = {
          id: 'snapshot_' + snapshot.id,
          sessionId,
          role: 'system',
          isSummary: true,
          orderIndex: -1,
          createdAt: new Date(),
          parts: [{
            id: 'p_snapshot_' + snapshot.id,
            messageId: 'snapshot_' + snapshot.id,
            sessionId,
            type: 'text',
            data: { text: `[往期对话摘要压缩]：\n${snapshot.summaryText}` }
          }]
        };
        effectiveMessages = [summaryMsg, ...rawMessages.slice(cutoffIndex + 1)];
      } else {
        effectiveMessages = [...rawMessages];
      }
    } else {
      effectiveMessages = [...rawMessages];
    }

    // 2. 软限界滑动窗口
    if (config.recentCount <= 0 || effectiveMessages.length <= config.recentCount) {
      return effectiveMessages;
    }

    // 例如还有 50 条，但只留 30 条 => endIndex-30 => 20
    let startIndex = effectiveMessages.length - config.recentCount;

    // 假设首条已被刚才注入了 Summary System，死保它！
    if (snapshot && startIndex > 0) {
      startIndex = Math.max(1, startIndex); // 保证不能切到底 0 (0是summary)
    }

    // 3. 安全退行逻辑：保证如果 startIndex 指向了一条悬空的 tool result 或没结束的 tool call 给退到正常的起点
    // Vercel AI SDK 极其严格，如果你给它发一个 { role: 'tool', ... } 但是前面并没有它对应的主脑 { role: 'assistant', call }，一定报错。
    while (
       startIndex > 0 && startIndex < effectiveMessages.length &&
       // 如果头是 tool result 必须要带上属于它的 assistant call (它的上一条或者上面若干条)
       effectiveMessages[startIndex].role === 'tool'
    ) {
       startIndex--;
    }
    // 进一步安全：如果 startIndex 现在是 assistant，我们要确保它本身不是只有 call（通常如果是正常的结束它就是发 tool call，下一句马上接 tool result。我们应该把从它产生的连续请求都框进来）
    // 但倒退回去时，如果是 assistant 发起的工具，倒退它自身没问题！

    startIndex = Math.max(0, startIndex);

    if (snapshot && startIndex > 0) {
      return [effectiveMessages[0], ...effectiveMessages.slice(startIndex)];
    }

    return effectiveMessages.slice(startIndex);
  }
}
