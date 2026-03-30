/**
 * 会话压缩 Prompt 模板
 *
 * 1:1 复刻白守的 CompressionPrompt，用中文指导 LLM 生成结构化摘要。
 * 原始实现：lib/agent/session/compression_prompt.dart
 */

export interface CompressionPromptInput {
  /** 上一次压缩生成的摘要文本（首次压缩时为 undefined） */
  previousSummary?: string;
  /** 需要被压缩的新消息，已格式化为纯文本 */
  messagesToCompress: string;
}

/**
 * 构建压缩 prompt
 */
export function buildCompressionPrompt(input: CompressionPromptInput): string {
  return `你是一个对话摘要引擎。你的任务是将对话历史压缩为一份结构化摘要，供后续对话使用。

## 规则
1. 保留所有关键事实、决策、结论、用户偏好
2. 保留所有重要的情感表达、关系动态、共同回忆
3. 丢弃寒暄、重复、过渡性语句
4. 如果提供了旧摘要，将旧摘要的内容与新消息合并，生成一份完整的更新版摘要
5. 输出格式使用 Markdown，按主题分段
6. 用第三人称描述（"用户说..."、"伙伴回复..."）

## 旧摘要
${input.previousSummary ?? '无，这是首次压缩'}

## 需要压缩的新消息
${input.messagesToCompress}

## 请输出更新后的完整摘要：`;
}

/**
 * 将消息列表格式化为压缩输入文本
 */
export function formatMessagesForCompression(
  messages: Array<{ role: string; content?: string | null }>,
): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const content = msg.content ?? '';
    if (content.length > 0) {
      lines.push(`[${msg.role}]: ${content}\n`);
    }
  }
  return lines.join('');
}
