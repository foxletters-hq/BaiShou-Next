/**
 * 会话压缩服务
 *
 * 1:1 复刻白守的 CompressionService。
 * 职责：当上下文 token 数超过阈值时，执行两阶段压缩：
 *   1. 剪枝（prune） — 擦除旧的 tool 输出，纯本地操作
 *   2. 摘要（summarize） — 调用 LLM 将旧对话压缩为结构化摘要
 *
 * 原始实现：lib/agent/session/compression_service.dart (259 行)
 */

import {
  buildCompressionPrompt,
  formatMessagesForCompression,
} from './compression-prompt';

// ─── 类型定义 ──────────────────────────────────────────────

export interface CompressionSnapshot {
  id: string;
  sessionId: string;
  summaryText: string;
  coveredUpToMessageId: string;
  messageCount: number;
  createdAt: Date;
}

export interface CompressibleMessage {
  id: string;
  role: string;
  content?: string | null;
}

/** 压缩快照仓库接口——遵循依赖倒置原则 */
export interface CompressionSnapshotRepository {
  getLatestSnapshot(sessionId: string): Promise<CompressionSnapshot | null>;
  insertSnapshot(
    input: Omit<CompressionSnapshot, 'id' | 'createdAt'>,
  ): Promise<CompressionSnapshot>;
}

/** 消息仓库接口——压缩服务只需要读消息和更新消息内容 */
export interface CompressibleMessageRepository {
  getMessagesBySession(sessionId: string): Promise<CompressibleMessage[]>;
  updateMessageContent(messageId: string, newContent: string): Promise<void>;
}

/** AI 摘要生成器接口——压缩服务不关心具体供应商 */
export interface SummaryGenerator {
  generateSummary(prompt: string): Promise<string>;
}

// ─── 常量 ────────────────────────────────────────────────

/** 默认压缩时保留的最近用户对话轮数 */
const DEFAULT_RETAIN_USER_TURNS = 3;

/** 被剪枝后的替代文本 */
const PRUNED_PLACEHOLDER = '[工具输出已剪枝]';

/** 粗略估算文本 token 数（仅用于剪枝判断，不用于压缩触发） */
function roughTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 3.5);
}

// ─── 服务实现 ──────────────────────────────────────────────

export class CompressionService {
  constructor(
    private readonly snapshotRepo: CompressionSnapshotRepository,
    private readonly messageRepo: CompressibleMessageRepository,
    private readonly summaryGenerator: SummaryGenerator,
  ) {}

  /**
   * 检查是否需要压缩
   * @param currentContextTokens 当前上下文的真实 token 数
   * @param threshold 用户设定的压缩阈值（0 表示禁用）
   */
  shouldCompress(currentContextTokens: number, threshold: number): boolean {
    if (threshold <= 0) return false;
    return currentContextTokens > threshold;
  }

  /**
   * 剪枝：保留最近一部分工具输出，擦除更早的
   *
   * 保护区 = 阈值 × 50%，最小收益 = 阈值 × 20%
   * 纯本地操作，不需要 AI 调用
   */
  async prune(sessionId: string, threshold: number): Promise<number> {
    const pruneProtect = Math.floor(threshold * 0.5);
    const pruneMinimum = Math.floor(threshold * 0.2);

    const allMessages = await this.messageRepo.getMessagesBySession(sessionId);

    let totalToolTokens = 0;
    let prunedTokens = 0;
    const toPrune: CompressibleMessage[] = [];

    // 从后往前遍历
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const msg = allMessages[i]!;
      if (msg.role !== 'tool') continue;

      const content = msg.content ?? '';
      if (content === PRUNED_PLACEHOLDER) continue;

      const tokens = roughTokens(content);
      totalToolTokens += tokens;

      // 保护区内的不动
      if (totalToolTokens <= pruneProtect) continue;

      prunedTokens += tokens;
      toPrune.push(msg);
    }

    // 收益不够就不剪
    if (prunedTokens < pruneMinimum) {
      return 0;
    }

    // 执行剪枝
    for (const msg of toPrune) {
      await this.messageRepo.updateMessageContent(msg.id, PRUNED_PLACEHOLDER);
    }

    return toPrune.length;
  }

  /**
   * 执行完整压缩：先剪枝，再摘要
   */
  async compress(
    sessionId: string,
    options: {
      threshold: number;
      keepTurns?: number;
    },
  ): Promise<void> {
    const retainTurns = options.keepTurns ?? DEFAULT_RETAIN_USER_TURNS;

    // Step 1: 剪枝旧工具输出
    await this.prune(sessionId, options.threshold);

    // Step 2: 摘要压缩
    const snapshot = await this.snapshotRepo.getLatestSnapshot(sessionId);
    const allMessages =
      await this.messageRepo.getMessagesBySession(sessionId);

    // 获取压缩点之后的消息
    const messagesAfterPoint = this.getMessagesAfterCompressionPoint(
      allMessages,
      snapshot,
    );

    // 保留最近 N 轮 user 消息及其后续的所有消息不参与压缩
    let userTurnsSeen = 0;
    let retainFromIndex = messagesAfterPoint.length;
    for (let i = messagesAfterPoint.length - 1; i >= 0; i--) {
      const msg = messagesAfterPoint[i]!;
      const nextMsgInTimeline = i < messagesAfterPoint.length - 1 ? messagesAfterPoint[i + 1] : null;
      const isUser = msg.role === 'user';

      if (isUser && (!nextMsgInTimeline || nextMsgInTimeline.role !== 'user')) {
        userTurnsSeen++;
      }

      if (userTurnsSeen === retainTurns && isUser) {
        retainFromIndex = i;
      } else if (userTurnsSeen > retainTurns) {
        break;
      }
    }
    // 如果 user 轮数不足 retainTurns，说明消息太少，不需要压缩
    if (userTurnsSeen < retainTurns) return;

    if (retainFromIndex <= 0) return;

    const messagesToCompress = messagesAfterPoint.slice(0, retainFromIndex);
    if (messagesToCompress.length === 0) return;

    // 确保不在 tool call pair 中间截断
    let cutIndex = messagesToCompress.length;
    while (cutIndex > 0 && messagesToCompress[cutIndex - 1]!.role === 'tool') {
      cutIndex--;
    }
    if (cutIndex <= 0) return;
    const safeMessages = messagesToCompress.slice(0, cutIndex);

    // 构建 prompt
    const formattedMessages = formatMessagesForCompression(safeMessages);
    const prompt = buildCompressionPrompt({
      previousSummary: snapshot?.summaryText,
      messagesToCompress: formattedMessages,
    });

    // 调用 AI 生成摘要
    const summaryText = await this.summaryGenerator.generateSummary(prompt);
    if (summaryText.length === 0) return;

    // 存入快照
    const previousCount = snapshot?.messageCount ?? 0;
    const newCount = previousCount + safeMessages.length;
    const lastCompressedMessage = safeMessages[safeMessages.length - 1]!;

    await this.snapshotRepo.insertSnapshot({
      sessionId,
      summaryText,
      coveredUpToMessageId: lastCompressedMessage.id,
      messageCount: newCount,
    });
  }

  /** 获取压缩点之后的消息 */
  private getMessagesAfterCompressionPoint(
    allMessages: CompressibleMessage[],
    snapshot: CompressionSnapshot | null,
  ): CompressibleMessage[] {
    if (!snapshot) return allMessages;

    const cutoffIndex = allMessages.findIndex(
      (m) => m.id === snapshot.coveredUpToMessageId,
    );

    if (cutoffIndex < 0) return allMessages;
    return allMessages.slice(cutoffIndex + 1);
  }
}
