import { z } from 'zod'

export enum SummaryType {
  weekly = 'weekly',
  monthly = 'monthly',
  quarterly = 'quarterly',
  yearly = 'yearly'
}

export const SummaryTypeSchema = z.nativeEnum(SummaryType)

export const SummarySchema = z.object({
  id: z.number().int().positive().optional(),
  type: SummaryTypeSchema,
  startDate: z.date(),
  endDate: z.date(),
  content: z.string().min(1),
  sourceIds: z.string().optional().nullable(),
  generatedAt: z.date().optional(),
  /** 手动保存时间；有值且晚于 generatedAt 时 UI 显示「保存于」 */
  updatedAt: z.date().optional().nullable()
})

export type Summary = z.infer<typeof SummarySchema>
export type CreateSummaryInput = Omit<Summary, 'id' | 'generatedAt' | 'updatedAt'>
export type UpdateSummaryInput = Partial<Omit<Summary, 'id'>>

export interface MissingSummary {
  type: SummaryType
  startDate: Date
  endDate: Date
  label: string
  weekNumber?: number
}

export interface ContextResult {
  text: string
  yearCount: number
  quarterCount: number
  monthCount: number
  weekCount: number
  diaryCount: number
}

/** 共同回忆复制预览（级联折叠后的条目统计） */
export interface SharedMemoryCopyPreview {
  lookbackMonths: number
  yearly: number
  quarterly: number
  monthly: number
  weekly: number
  diary: number
  total: number
  /** 复制全文（含标题与前缀）的字符数 */
  estimatedChars: number
  /** 粗估 token 数（约 3 字符/token） */
  estimatedTokens: number
}

export const DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS = 1
export const SHARED_MEMORY_LOOKBACK_MIN = 1
export const SHARED_MEMORY_LOOKBACK_MAX = 120

export function clampSharedMemoryLookbackMonths(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_SHARED_MEMORY_LOOKBACK_MONTHS
  return Math.min(SHARED_MEMORY_LOOKBACK_MAX, Math.max(SHARED_MEMORY_LOOKBACK_MIN, Math.round(n)))
}
