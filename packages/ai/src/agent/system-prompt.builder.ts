import {
  buildContextEncodingSystemPromptLines,
  buildOutputProtocolSystemPromptLines,
  getAssistantKindLabelKey,
  translateMain,
  type AssistantKind
} from '@baishou/shared'
import { buildToolUsageGuidelines } from './tool-usage-guidelines.util'

export interface SystemPromptBuilderOptions {
  vaultName: string
  tools: Record<string, any> // 此刻所有通过了验证准备好交给模型的 Tool 实例集
  customPersona?: string
  customGuidelines?: string
  userProfileBlock?: string
  /** 伙伴使用写日记 / 编辑日记工具时的书写规范 */
  diaryAiWritingPrompt?: string
  /** 亲密伙伴 / 工作伙伴，影响能力边界说明 */
  assistantKind?: AssistantKind
  /** 是否在 system prompt 中注入当前时间，默认 true（兼容旧配置） */
  injectCurrentTime?: boolean
  /** App UI 语言，用于用户可见固定话术（如联网未开提示） */
  locale?: string
}

function pushSection(buffer: string[], tag: string, lines: string[]): void {
  if (lines.length === 0) return
  buffer.push(`<${tag}>`)
  buffer.push(...lines)
  buffer.push(`</${tag}>`)
  buffer.push('')
}

function formatSystemCurrentTime(now = new Date()): string {
  const tzOffset = -now.getTimezoneOffset() / 60
  const tzSign = tzOffset >= 0 ? '+' : ''
  const dateStr =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')} ` +
    `${String(now.getHours()).padStart(2, '0')}:` +
    `${String(now.getMinutes()).padStart(2, '0')}`
  return `[System Current Date / Time]: ${dateStr} (UTC${tzSign}${tzOffset})`
}

function resolveLocale(locale?: string): string | undefined {
  if (!locale || locale.trim() === '' || locale === 'system') return undefined
  return locale
}

/**
 * 构建带有当前环境、输出协议、生效工具以及自定义教条的最终提示词。
 *
 * 固定分区顺序：
 * persona → output_protocol → runtime_context → context_encoding(条件) →
 * user_identity → assistant_capabilities → available_tools →
 * tool_usage_guidelines → diary_writing_guidelines → behavior_guidelines
 */
export class SystemPromptBuilder {
  public static build(options: SystemPromptBuilderOptions): string {
    const {
      vaultName,
      tools,
      customPersona,
      customGuidelines,
      userProfileBlock,
      diaryAiWritingPrompt,
      assistantKind = 'companion',
      injectCurrentTime = true,
      locale
    } = options

    const buffer: string[] = []
    const availableToolIds = Object.keys(tools)
    const toolUsageGuidelines = buildToolUsageGuidelines(availableToolIds)
    const promptLocale = resolveLocale(locale)
    const kindLabel = translateMain(
      promptLocale,
      getAssistantKindLabelKey(assistantKind),
      assistantKind === 'work' ? 'Work' : 'Companion'
    )

    // 1. persona
    if (customPersona && customPersona.trim().length > 0) {
      pushSection(buffer, 'assistant_persona', [customPersona.trim()])
    }

    // 2. output_protocol（始终存在）
    pushSection(buffer, 'output_protocol', buildOutputProtocolSystemPromptLines())

    // 3. runtime_context
    const runtimeLines: string[] = []
    if (injectCurrentTime) {
      runtimeLines.push(formatSystemCurrentTime())
    } else {
      runtimeLines.push(
        'Note: System current time is not injected. Use the **current_time** tool when you need "now".'
      )
    }
    runtimeLines.push(`[Current Vault / Workspace]: ${vaultName}`)
    runtimeLines.push(`[Partner type]: ${assistantKind === 'work' ? 'work' : 'companion'}`)
    pushSection(buffer, 'runtime_context', runtimeLines)

    // 4. context_encoding（仅在会给历史加壳时）
    if (injectCurrentTime) {
      pushSection(buffer, 'context_encoding', buildContextEncodingSystemPromptLines())
    }

    // 5. user_identity
    if (userProfileBlock && userProfileBlock.trim().length > 0) {
      pushSection(buffer, 'user_identity', [
        '[Important: The following identity card describes the USER (human), NOT you (the AI assistant). Use this information to personalize your responses, but NEVER claim these facts as your own identity.]',
        userProfileBlock.trim()
      ])
    }

    // 6. assistant_capabilities（稳定枚举 + 本地化展示名，无硬编码中文）
    if (assistantKind === 'work') {
      pushSection(buffer, 'assistant_capabilities', [
        `Partner type: work (${kindLabel}).`,
        'Scope: knowledge lookup, web search, and work assistance only. ' +
          'Diary read/write, structured summaries, vector/memory search, and cross-session message search are NOT available—do not claim to access them.'
      ])
    } else {
      pushSection(buffer, 'assistant_capabilities', [
        `Partner type: companion (${kindLabel}).`,
        toolUsageGuidelines
          ? 'Diary and memory tools may be available—follow the tool usage guidelines strictly.'
          : 'Diary and memory tools may be available when enabled by the user.'
      ])
    }

    // 7. available_tools
    if (availableToolIds.length > 0) {
      const toolLines: string[] = [
        'Available Tools:',
        'Use a tool when it improves accuracy or when the tool usage guidelines below mark it as required. ' +
          'If the current conversation (including any rolling compression summary) already contains sufficient facts, you may answer without tools.',
        ''
      ]
      for (const id of availableToolIds) {
        const toolObj = tools[id]
        const hint = toolObj?.description || 'No description provided.'
        toolLines.push(`- **${id}**: ${hint}`)
      }
      toolLines.push('')

      const hasDiaryOrSummaryTools = availableToolIds.some(
        (id) => id.startsWith('diary_') || id === 'summary_read'
      )
      if (
        hasDiaryOrSummaryTools &&
        (!availableToolIds.includes('memory_store') || !availableToolIds.includes('vector_search'))
      ) {
        toolLines.push(
          'Note: Memory/RAG tools are currently disabled by the user. ' +
            'For storing and retrieving information, use the diary/summary tools instead. ' +
            'Do NOT attempt to call memory_store or vector_search.'
        )
        toolLines.push('')
      }

      if (!availableToolIds.includes('web_search')) {
        const webSearchNotEnabled = translateMain(
          promptLocale,
          'agent.tools.web_search_not_enabled',
          'Web search not enabled. Please enable it in the toolbar.'
        )
        toolLines.push(
          'Note: Web search tool is not enabled yet. ' +
            'If the user asks about recent events or current information that requires web search, ' +
            `reply with exactly: "${webSearchNotEnabled}"`
        )
        toolLines.push('')
      }

      pushSection(buffer, 'available_tools', toolLines)
    } else {
      pushSection(buffer, 'available_tools', ['No tools are currently available.'])
    }

    // 8. tool_usage_guidelines
    if (toolUsageGuidelines) {
      pushSection(buffer, 'tool_usage_guidelines', [toolUsageGuidelines])
    }

    // 9. diary_writing_guidelines
    const hasDiaryWriteTools =
      availableToolIds.includes('diary_write') || availableToolIds.includes('diary_edit')
    if (hasDiaryWriteTools && diaryAiWritingPrompt?.trim()) {
      pushSection(buffer, 'diary_writing_guidelines', [diaryAiWritingPrompt.trim()])
    }

    // 10. behavior_guidelines
    if (customGuidelines && customGuidelines.trim().length > 0) {
      pushSection(buffer, 'behavior_guidelines', [customGuidelines.trim()])
    }

    return buffer.join('\n').trimEnd() + '\n'
  }
}
