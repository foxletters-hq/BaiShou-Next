import {
  DEFAULT_DIARY_AI_WRITING_PROMPT,
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
} from '../constants/diary-templates'
import type { DiaryTemplateConfig } from '../types/settings.types'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** 本地时间格式化，避免 shared 包引入 date-fns 导致 Electron 主进程打包后 require 失败 */
function formatDiaryTemplateDate(date: Date, pattern: 'HH:mm:ss' | 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm:ss'): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hours = pad2(date.getHours())
  const minutes = pad2(date.getMinutes())
  const seconds = pad2(date.getSeconds())

  switch (pattern) {
    case 'HH:mm:ss':
      return `${hours}:${minutes}:${seconds}`
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`
    case 'yyyy-MM-dd HH:mm:ss':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
}

export function applyDiaryTemplateVars(template: string, date: Date = new Date()): string {
  return template
    .replace(/\{time\}/g, formatDiaryTemplateDate(date, 'HH:mm:ss'))
    .replace(/\{date\}/g, formatDiaryTemplateDate(date, 'yyyy-MM-dd'))
    .replace(/\{datetime\}/g, formatDiaryTemplateDate(date, 'yyyy-MM-dd HH:mm:ss'))
}

export function resolveDiaryNewEntryContent(
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const template = config?.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
  return applyDiaryTemplateVars(template, date)
}

export function resolveDiaryAppendBlock(
  config: DiaryTemplateConfig | null | undefined,
  date: Date = new Date()
): string {
  const template = config?.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE
  return applyDiaryTemplateVars(template, date)
}

export function resolveDiaryAiWritingPrompt(
  config: DiaryTemplateConfig | null | undefined
): string {
  return config?.aiWritingPrompt?.trim() || DEFAULT_DIARY_AI_WRITING_PROMPT
}

/**
 * 构建注入 Agent 系统提示词的完整日记书写规范（含伙伴提示词与追加模板说明）。
 */
export function buildDiaryWritingGuidelinesForSystemPrompt(
  config: DiaryTemplateConfig | null | undefined,
  referenceDate: Date = new Date()
): string {
  const writingPrompt = resolveDiaryAiWritingPrompt(config)
  const appendTemplate = config?.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE
  const appendExample = resolveDiaryAppendBlock(config, referenceDate).replace(/\u200B$/, '')

  return [
    writingPrompt.trim(),
    '',
    '关于 diary_edit 追加模式（append）：',
    `- 系统会在你提交的 content 之前自动插入时间块；当前追加记录模板为：${appendTemplate}`,
    `- 按当前时间解析后的插入示例：${JSON.stringify(appendExample)}`,
    '- content 参数中请勿重复写入时间标题行，只写正文内容。'
  ].join('\n')
}
