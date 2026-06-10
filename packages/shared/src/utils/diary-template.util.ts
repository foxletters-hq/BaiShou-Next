import { format } from 'date-fns'
import {
  DEFAULT_DIARY_AI_WRITING_PROMPT,
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
} from '../constants/diary-templates'
import type { DiaryTemplateConfig } from '../types/settings.types'

export function applyDiaryTemplateVars(template: string, date: Date = new Date()): string {
  return template
    .replace(/\{time\}/g, format(date, 'HH:mm:ss'))
    .replace(/\{date\}/g, format(date, 'yyyy-MM-dd'))
    .replace(/\{datetime\}/g, format(date, 'yyyy-MM-dd HH:mm:ss'))
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
