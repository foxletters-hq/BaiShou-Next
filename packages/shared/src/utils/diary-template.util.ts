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

/** 可选补充说明（风格/内容要求；格式由模板统一决定） */
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

/**
 * 由模板推导 Agent 格式规范（编辑器插入、工具写入、系统提示词共用同一来源）。
 */
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
    '日记时间标题与块结构由下方模板统一决定（编辑器、Agent 工具自动插入与系统提示词均遵循同一套模板）：',
    '',
    '关于 diary_write 新建日记：',
    `- 新建日记模板：${newEntryTemplate}`,
    `- 按当前时间解析后的示例：${JSON.stringify(newEntryExample)}`,
    '- 若 content 未包含时间标题行，系统会自动按上述模板插入；content 只需写正文即可。',
    '',
    '关于 diary_edit 追加模式（append，默认首选）：',
    `- 追加记录模板：${appendTemplate}`,
    `- 按当前时间解析后的插入示例：${JSON.stringify(appendExample)}`,
    '- 系统会在 content 之前自动插入上述时间块；请勿在 content 中重复写入纯时间标题行。',
    '- 若 content 以「时间 + 小标题」的 Markdown 标题行开头（例如 ###### 14:30 - 下午茶），系统将以该行为本章标题，不再额外插入纯时间块。',
    '- 请勿先写纯时间标题、再另起一条带小标题的时间标题；若使用小标题，一条时间标题行即可。',
    '- append 模式下 content **只传新增段落**，不要传整篇日记；已有段落由系统保留在原文中，无需重复写入。',
    '- 用户要求修改既有某段时：优先 append 追加勘误说明；若必须改写该段，overwrite 时须基于 diary_read 全文，**保留所有未修改段落**，仅替换目标段。',
    '',
    '关于 diary_edit 覆盖模式（overwrite，慎用）：',
    '- 仅在用户**明确要求**替换/重写当天整篇日记，或需在保留其他段落前提下重写某段时使用。',
    '- content 必须是**完整正文**：包含 diary_read 中所有要保留的段落 + 修改后的段落。',
    '- **禁止**只传修改后的片段或删减后的节选——未写入 content 的段落会被永久删除。',
    '',
    '通用：标签请通过工具的 tags 参数传递，不要只写在正文中。'
  ].join('\n')
}

/** @deprecated 请使用 buildDiaryWritingGuidelinesForSystemPrompt */
export function resolveDiaryAiWritingPrompt(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  return buildDiaryWritingGuidelinesForSystemPrompt(config, referenceDate)
}

const DIARY_TIMESTAMP_HEADING_LINE_RE = /^#{1,6}\s+\d{2}:\d{2}(:\d{2})?\s*$/

/** 带小标题的章节行，如 ###### 14:30 - 下午茶 */
const DIARY_TITLED_SECTION_HEADING_LINE_RE = /^#{1,6}\s+\d{2}:\d{2}(:\d{2})?\s*[-–—:：]\s*.+/

function getFirstDiaryContentLine(content: string): string {
  return (
    content
      .replace(/^\uFEFF/, '')
      .trimStart()
      .split('\n')[0]
      ?.trim() ?? ''
  )
}

/** 正文是否以 Markdown 纯时间标题行开头（##### / ###### HH:mm 等；兼容旧版 HH:mm:ss） */
export function contentStartsWithDiaryTimestampHeading(content: string): boolean {
  return DIARY_TIMESTAMP_HEADING_LINE_RE.test(getFirstDiaryContentLine(content))
}

/** 正文是否以「时间 + 小标题」章节行开头（例如 ###### 14:30 - 下午茶） */
export function contentStartsWithDiaryTitledSectionHeading(content: string): boolean {
  return DIARY_TITLED_SECTION_HEADING_LINE_RE.test(getFirstDiaryContentLine(content))
}

/** 去掉 Agent 在 append 正文中误写的纯时间标题行，避免与系统插入块重复 */
export function stripLeadingDiaryTimestampHeading(content: string): string {
  const normalized = content.replace(/^\uFEFF/, '')
  const lines = normalized.split('\n')
  let index = 0
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? ''
    if (trimmed === '') {
      index++
      continue
    }
    if (DIARY_TIMESTAMP_HEADING_LINE_RE.test(trimmed)) {
      index++
      continue
    }
    break
  }
  if (index === 0) return content
  return lines.slice(index).join('\n')
}

/** 新建日记：若正文缺少时间标题，则按「新建日记模板」自动插入 */
export function prepareDiaryWriteContent(
  content: string,
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const body = stripLeadingDiaryTimestampHeading(content)
  if (contentStartsWithDiaryTitledSectionHeading(body)) {
    return body
  }
  if (contentStartsWithDiaryTimestampHeading(content)) {
    return content
  }
  const block = resolveDiaryNewEntryContent(config, date).replace(/\u200B$/, '')
  return block + body
}

/**
 * 将已有正文与追加时间块拼接，确保非空正文与时间标题之间至少有一个换行。
 * 模板若缺少前导 \\n（例如设置页 trim 后）也不会贴在上一条末尾。
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

/** 追加日记：按「追加记录模板」插入时间块，并剥离 Agent 重复写入的时间标题 */
export function prepareDiaryAppendContent(
  existingContent: string,
  content: string,
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const body = stripLeadingDiaryTimestampHeading(content)
  if (contentStartsWithDiaryTitledSectionHeading(body)) {
    return joinDiaryContentWithAppendBlock(existingContent, '') + body
  }
  const block = resolveDiaryAppendBlock(config, date)
  return joinDiaryContentWithAppendBlock(existingContent, block) + body
}

/**
 * 构建注入 Agent 系统提示词的完整日记书写规范。
 * 格式部分由模板推导；writingStyleSupplement 仅承载风格/内容补充。
 */
export function buildDiaryWritingGuidelinesForSystemPrompt(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  const parts = [buildDiaryFormatRulesFromTemplates(config, referenceDate)]
  const supplement = resolveDiaryWritingStyleSupplement(config)
  if (supplement) {
    parts.push('', '补充书写说明（风格与内容要求，格式仍以上方模板为准）：', supplement)
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
