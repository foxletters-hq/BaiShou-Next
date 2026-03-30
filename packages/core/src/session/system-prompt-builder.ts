/**
 * Agent System Prompt 构建器
 *
 * 根据上下文动态构建 Agent 的系统提示词。
 * 所有文案从外部传入（i18n 或用户设置），不硬编码任何内容。
 *
 * 原始实现：lib/agent/prompts/system_prompt_builder.dart (79 行)
 */

export interface SystemPromptConfig {
  /** 人设描述（来自用户设置或 i18n 默认值） */
  persona?: string;
  /** 行为准则（来自用户设置或 i18n 默认值） */
  guidelines?: string;
  /** 用户身份卡片文本 */
  userProfileBlock?: string;
  /** 当前 Vault 名称 */
  vaultName: string;
  /** 可用工具 ID → 描述映射 */
  tools: Array<{ id: string; description: string }>;
}

/**
 * 构建完整的 Agent System Prompt
 */
export function buildSystemPrompt(config: SystemPromptConfig): string {
  const parts: string[] = [];

  // 人设
  if (config.persona && config.persona.length > 0) {
    parts.push(config.persona);
  }

  // 用户身份卡
  if (config.userProfileBlock && config.userProfileBlock.length > 0) {
    parts.push(config.userProfileBlock);
  }

  // 时间上下文
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  parts.push(`${year}-${month}-${day} ${hour}:${minute}`);

  // Vault 上下文
  parts.push(`Vault: ${config.vaultName}`);

  // 可用工具说明
  if (config.tools.length > 0) {
    const toolLines = config.tools.map(
      (t) => `- **${t.id}**: ${t.description}`,
    );
    parts.push(toolLines.join('\n'));

    // RAG 工具禁用时，指引 AI 使用日记工具
    const hasMemoryStore = config.tools.some((t) => t.id === 'memory_store');
    const hasVectorSearch = config.tools.some((t) => t.id === 'vector_search');
    if (!hasMemoryStore || !hasVectorSearch) {
      parts.push(
        'Note: Memory/RAG tools are currently disabled by the user. ' +
          'For storing and retrieving information, use the diary/summary tools instead. ' +
          'Do NOT attempt to call memory_store or vector_search.',
      );
    }
  }

  // 行为准则
  if (config.guidelines && config.guidelines.length > 0) {
    parts.push(config.guidelines);
  }

  return parts.join('\n\n');
}
