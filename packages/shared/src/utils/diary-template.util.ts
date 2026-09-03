import {
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE,
  LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT
} from '../constants/diary-templates'
import type { DiaryTemplateConfig } from '../types/settings.types'

/** 用于 UI 预览与 Agent 注入的临时模板配置 */
export type DiaryTemplateDraftConfig = Pick<
  DiaryTemplateConfig,
  'newEntryTemplate' | 'appendBlockTemplate' | 'writingStyleSupplement' | 'aiWritingPrompt'
>

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** 本地时间格式化，避免 shared 包引入 date-fns 导致 Electron 主进程打包后 require 失败 */
function formatDiaryTemplateDate(
  date: Date,
  pattern: 'HH:mm' | 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm'
): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())

  switch (pattern) {
    case 'HH:mm':
      return `${hours}:${minutes}`
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`
    case 'yyyy-MM-dd HH:mm':
      return `${year}-${month}-${day} ${hours}:${minutes}`
  }
}

export function applyDiaryTemplateVars(template: string, date: Date = new Date()): string {
  return template
    .replace(/\{time\}/g, formatDiaryTemplateDate(date, 'HH:mm'))
    .replace(/\{date\}/g, formatDiaryTemplateDate(date, 'yyyy-MM-dd'))
    .replace(/\{datetime\}/g, formatDiaryTemplateDate(date, 'yyyy-MM-dd HH:mm'))
}

function trimDiaryTemplateValue(value: string): string {
  return value.replace(/[ \t]+$/u, '')
}

function resolveDiaryTemplate(configValue: string | undefined, fallback: string): string {
  if (configValue == null) return fallback
  if (!configValue.trim()) return fallback
  return trimDiaryTemplateValue(configValue)
}

/** 追加块末尾保留空行，便于正文接在时间标题后 */
function normalizeResolvedAppendBlock(block: string): string {
  const zwspSuffix = block.endsWith('\u200B') ? '\u200B' : ''
  let core = block.replace(/\u200B$/, '')
  if (!core.endsWith('\n')) {
    core += '\n\n'
  } else if (!core.endsWith('\n\n')) {
    core += '\n'
  }
  return core + zwspSuffix
}

export function resolveDiaryNewEntryContent(
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const template = resolveDiaryTemplate(config?.newEntryTemplate, DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
  return applyDiaryTemplateVars(template, date)
}

export function resolveDiaryAppendBlock(
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const template = resolveDiaryTemplate(
    config?.appendBlockTemplate,
    DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE
  )
  return normalizeResolvedAppendBlock(applyDiaryTemplateVars(template, date))
}

/**
 * 编辑器将已有正文与用户配置的追加模板拼接。
 * 模板缺少前导换行时，也确保不会贴在上一段末尾。
 */
export function joinDiaryContentWithAppendBlock(
  existingContent: string,
  appendBlock: string
): string {
  const existing = existingContent.trimEnd()
  const block = appendBlock.replace(/\u200B$/, '')
  if (!existing) {
    return block.trimStart()
  }
  const normalizedBlock = block.startsWith('\n') ? block : `\n\n${block}`
  return existing + normalizedBlock
}

/** 可选补充说明（风格/内容要求；格式模板会作为助手的书写参考） */
export function resolveDiaryWritingStyleSupplement(
  config: DiaryTemplateConfig | null | undefined
): string {
  const supplement = config?.writingStyleSupplement?.trim()
  if (supplement) return supplement

  const legacy = config?.aiWritingPrompt?.trim()
  if (legacy && legacy !== LEGACY_DEFAULT_DIARY_AI_WRITING_PROMPT.trim()) {
    return legacy
  }
  return ''
}

/** 由编辑器模板推导助手可参考的日记书写说明。 */
export function buildDiaryFormatRulesFromTemplates(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  const newEntryTemplate = resolveDiaryTemplate(
    config?.newEntryTemplate,
    DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
  )
  const appendTemplate = resolveDiaryTemplate(
    config?.appendBlockTemplate,
    DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE
  )
  const newEntryExample = resolveDiaryNewEntryContent(config, referenceDate).replace(/\u200B$/, '')
  const appendExample = resolveDiaryAppendBlock(config, referenceDate).replace(/\u200B$/, '')

  return [
    '日记正文由你完整编写。系统不会自动添加、识别、删除或改写时间标题；以下编辑器模板仅作为书写结构参考：',
    '',
    '关于 diary_write 新建日记：',
    `- 新建日记模板：${newEntryTemplate}`,
    `- 按当前时间解析后的示例：${JSON.stringify(newEntryExample)}`,
    '- content 必须包含准备写入的完整 Markdown 正文。需要时间标题时，请参考上述模板自行写入，不要依赖系统补写。',
    '- 可根据用户要求和记录内容自行决定是否添加时间标题或小标题，并保持正文结构清楚。',
    '- 标签请直接写进 content，例如在对应标题下写 `#工作 #会议`，空一行后再写正文。',
    '',
    '关于 diary_edit 追加模式（append，默认首选）：',
    `- 追加记录参考模板：${appendTemplate}`,
    `- 按当前时间解析后的参考示例：${JSON.stringify(appendExample)}`,
    '- 系统只会把 content 作为新段落追加到已有正文末尾，不会自动添加或删除时间标题。',
    '- 需要时间标题、小标题和标签时，请在 content 中完整写出；可根据本次内容自行组织。',
    '- 不要修改当天其它段落里的标签。',
    '- append 模式下 content **只传新增段落**，不要传整篇日记；已有段落由系统保留在原文中，无需重复写入。',
    '- 用户要求修改既有某段时：优先 append 追加勘误说明；若必须改写该段，overwrite 时须基于 diary_read 全文，**保留所有未修改段落**，仅替换目标段。',
    '',
    '关于 diary_edit 覆盖模式（overwrite，慎用）：',
    '- 仅在用户**明确要求**替换/重写当天整篇日记，或需在保留其他段落前提下重写某段时使用。',
    '- content 必须是**完整正文**：包含 diary_read 中所有要保留的段落 + 修改后的段落。',
    '- **禁止**只传修改后的片段或删减后的节选——未写入 content 的段落会被永久删除。',
    '',
    '通用：标签必须由你直接写成正文 `#标签`，不要写进文件头部；工具不提供独立的标签参数。'
  ].join('\n')
}

/** @deprecated 请使用 buildDiaryWritingGuidelinesForSystemPrompt */
export function resolveDiaryAiWritingPrompt(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  return buildDiaryWritingGuidelinesForSystemPrompt(config, referenceDate)
}

/**
 * 构建注入 Agent 系统提示词的完整日记书写规范。
 * 模板只作为书写参考；writingStyleSupplement 承载风格/内容补充。
 */
export function buildDiaryWritingGuidelinesForSystemPrompt(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  const parts = [buildDiaryFormatRulesFromTemplates(config, referenceDate)]
  const supplement = resolveDiaryWritingStyleSupplement(config)
  if (supplement) {
    parts.push('', '补充书写说明（风格与内容要求，可结合上方模板参考）：', supplement)
  }
  return parts.join('\n')
}

/** 设置页预览：根据当前编辑中的模板草稿生成 Agent 将看到的规范 */
export function previewDiaryAgentWritingGuidelines(
  draft: DiaryTemplateDraftConfig,
  referenceDate: Date = new Date()
): string {
  return buildDiaryWritingGuidelinesForSystemPrompt(draft, referenceDate)
}
