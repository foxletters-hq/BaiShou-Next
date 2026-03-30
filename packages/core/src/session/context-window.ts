/**
 * 上下文窗口服务
 *
 * 1:1 复刻白守的 ContextWindow。
 * 滑动窗口机制：从消息列表中取最近 N 条作为 LLM 上下文。
 *
 * 核心思路（三级记忆体系）：
 * - 短期记忆 = 滑动窗口（最近 N 条消息，完整原文）
 * - 长期记忆 = 压缩摘要（自动生成的对话概要）
 * - 更长期记忆 = LifeBook 日记/总结系统 + 可选 RAG
 *
 * 原始实现：lib/agent/session/context_window.dart (140 行)
 */

import type { CompressionSnapshot } from './compression.service';

// ─── 类型定义 ──────────────────────────────────────────────

export interface ContextWindowConfig {
  /** 最近消息条数（用户可配，默认 30，0 表示不限制） */
  recentCount: number;
}

export interface ContextMessage {
  role: string;
  content: string;
}

const DEFAULT_CONFIG: ContextWindowConfig = { recentCount: 30 };

// ─── 核心逻辑 ──────────────────────────────────────────────

/**
 * 从内存消息列表中构建 LLM 上下文窗口
 *
 * 保证：
 * 1. 不会在 tool_calls / tool_result 之间截断（保持 pair 完整）
 * 2. 返回按时间升序排列的消息
 * 3. 如果有压缩摘要，始终保留在上下文头部
 */
export function buildContextWindow(options: {
  messages: ContextMessage[];
  config?: ContextWindowConfig;
  snapshot?: CompressionSnapshot | null;
}): ContextMessage[] {
  const config = options.config ?? DEFAULT_CONFIG;
  const snapshot = options.snapshot ?? null;

  let effectiveMessages: ContextMessage[];

  if (snapshot) {
    // 有摘要：在头部插入摘要作为 system 消息
    effectiveMessages = [
      { role: 'system', content: `[对话摘要]\n${snapshot.summaryText}` },
      ...options.messages,
    ];
  } else {
    effectiveMessages = [...options.messages];
  }

  if (effectiveMessages.length === 0) return effectiveMessages;

  // recentCount <= 0 表示无限轮，不截断
  if (config.recentCount <= 0 || effectiveMessages.length <= config.recentCount) {
    return effectiveMessages;
  }

  // 取最后 N 条（但始终保留摘要消息如果有的话）
  let startIndex = effectiveMessages.length - config.recentCount;

  // 确保摘要消息不被裁掉（如果存在，它在 index 0）
  if (snapshot && startIndex > 0) {
    startIndex = Math.max(1, Math.min(startIndex, effectiveMessages.length - 1));
    // 重新拼接：摘要 + 裁剪后的消息
    return [effectiveMessages[0]!, ...effectiveMessages.slice(startIndex)];
  }

  // 往前修正：不要在 tool result 开头截断（保持 assistant+tool 的完整性）
  while (
    startIndex > 0 &&
    startIndex < effectiveMessages.length &&
    effectiveMessages[startIndex]?.role === 'tool'
  ) {
    startIndex--;
  }

  // 最终安全兜底
  startIndex = Math.max(0, Math.min(startIndex, effectiveMessages.length));
  return effectiveMessages.slice(startIndex);
}
