/**
 * 总结生成 Prompt 模板
 *
 * 统一使用中文提示词
 * 支持用户自定义完整模板（使用 {year}, {month} 等占位符）
 *
 * 原始实现：lib/agent/prompts/prompt_templates.dart (243 行)
 */

import { DEFAULT_SUMMARY_TEMPLATES, SummaryType } from '@baishou/shared'

export const DEFAULT_WEEKLY_PROMPT = DEFAULT_SUMMARY_TEMPLATES.weekly
export const DEFAULT_MONTHLY_PROMPT = DEFAULT_SUMMARY_TEMPLATES.monthly
export const DEFAULT_QUARTERLY_PROMPT = DEFAULT_SUMMARY_TEMPLATES.quarterly
export const DEFAULT_YEARLY_PROMPT = DEFAULT_SUMMARY_TEMPLATES.yearly

// ─── 模板构建函数 ──────────────────────────────────────────

/** 按类型获取默认模板 */
export function getDefaultTemplate(type: SummaryType): string {
  switch (type) {
    case SummaryType.weekly:
      return DEFAULT_WEEKLY_PROMPT
    case SummaryType.monthly:
      return DEFAULT_MONTHLY_PROMPT
    case SummaryType.quarterly:
      return DEFAULT_QUARTERLY_PROMPT
    case SummaryType.yearly:
      return DEFAULT_YEARLY_PROMPT
  }
}

/** 构建周报 prompt */
export function buildWeeklyPrompt(options: {
  year: number
  month: number
  week: number
  start: string
  end: string
  customTemplate?: string
}): string {
  const template = options.customTemplate ?? DEFAULT_WEEKLY_PROMPT
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{month}', String(options.month))
    .replaceAll('{week}', String(options.week))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end)
}

/** 构建月报 prompt */
export function buildMonthlyPrompt(options: {
  year: number
  month: number
  start: string
  end: string
  customTemplate?: string
}): string {
  const template = options.customTemplate ?? DEFAULT_MONTHLY_PROMPT
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{month}', String(options.month))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end)
}

/** 构建季报 prompt */
export function buildQuarterlyPrompt(options: {
  year: number
  quarter: number
  start: string
  end: string
  customTemplate?: string
}): string {
  const template = options.customTemplate ?? DEFAULT_QUARTERLY_PROMPT
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{quarter}', String(options.quarter))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end)
}

/** 构建年鉴 prompt */
export function buildYearlyPrompt(options: {
  year: number
  start: string
  end: string
  customTemplate?: string
}): string {
  const template = options.customTemplate ?? DEFAULT_YEARLY_PROMPT
  return template
    .replaceAll('{year}', String(options.year))
    .replaceAll('{start}', options.start)
    .replaceAll('{end}', options.end)
}
