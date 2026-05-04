export interface SystemPromptBuilderOptions {
  vaultName: string;
  tools: Record<string, any>; // 此刻所有通过了验证准备好交给模型的 Tool 实例集
  customPersona?: string;
  customGuidelines?: string;
  userProfileBlock?: string;
}

export class SystemPromptBuilder {
  /**
   * 构建带有当前环境、所在时间、生效工具以及自定义教条的最终提示词
   */
  public static build(options: SystemPromptBuilderOptions): string {
    const {
      vaultName,
      tools,
      customPersona,
      customGuidelines,
      userProfileBlock,
    } = options;

    const buffer: string[] = [];

    // 人设设定（如果用户或者系统传入了特殊要求）
    if (customPersona && customPersona.trim().length > 0) {
      buffer.push(customPersona);
      buffer.push('');
    }

    // 用户的偏好属性或者个人小卡片
    if (userProfileBlock && userProfileBlock.trim().length > 0) {
      buffer.push(userProfileBlock);
      buffer.push('');
    }

    // [不可动摇底线]：精准时间坐标，AI 最缺乏的就是时间观念
    const now = new Date();
    const tzOffset = -now.getTimezoneOffset() / 60;
    const tzSign = tzOffset >= 0 ? '+' : '';
    
    // YYYY-MM-DD HH:mm
    const dateStr = 
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}-` +
      `${String(now.getDate()).padStart(2, '0')} ` +
      `${String(now.getHours()).padStart(2, '0')}:` +
      `${String(now.getMinutes()).padStart(2, '0')}`;

    buffer.push(`[System Current Date / Time]: ${dateStr} (UTC${tzSign}${tzOffset})`);
    buffer.push(`[Current Vault / Workspace]: ${vaultName}`);
    buffer.push('');

    // 工具可用性宣告
    const availableToolIds = Object.keys(tools);
    if (availableToolIds.length > 0) {
      buffer.push('Available Tools:');
      for (const id of availableToolIds) {
         // 在 Vercel 中 getDescription 比较直接
         const toolObj = tools[id];
         const hint = toolObj?.description || 'No description provided.';
         buffer.push(`- **${id}**: ${hint}`);
      }
      buffer.push('');

      // 高级逻辑防降级：如果用户今天关了 RAG 或是关了 VectorSearch，必须给 AI 打预防针，防止它乱报错
      if (!availableToolIds.includes('memory_store') || !availableToolIds.includes('vector_search')) {
        buffer.push(
          'Note: Memory/RAG tools are currently disabled by the user. ' +
          'For storing and retrieving information, use the diary/summary tools instead. ' +
          'Do NOT attempt to call memory_store or vector_search.'
        );
        buffer.push('');
      }

      // 网络搜索工具未启用时，告知模型
      if (!availableToolIds.includes('web_search')) {
        buffer.push(
          'Note: Web search tool is currently disabled by the user. ' +
          'You cannot search the internet for real-time information. ' +
          'If the user asks about recent events or current information that requires web search, ' +
          'politely inform them that the search feature is not enabled and suggest they enable it in the toolbar if needed.'
        );
        buffer.push('');
      }
    } else {
      buffer.push('No tools are currently available.');
      buffer.push('');
    }

    // 额外的行为准则补丁
    if (customGuidelines && customGuidelines.trim().length > 0) {
      buffer.push(customGuidelines);
    }

    return buffer.join('\n');
  }
}
