import { z } from 'zod'
import { normalizeWeatherId, type WeatherId, WEATHER_IDS } from '../constants/weather.constants'

/** Weather id → emoji (canonical English ids only) */
export const WEATHER_EMOJI: Record<WeatherId, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  light_rain: '🌦️',
  heavy_rain: '🌧️',
  snow: '❄️',
  fog: '🌫️',
  windy: '💨'
}

/** 根据天气 id 获取对应 emoji，无匹配时返回默认 🌤️ */
export function getWeatherEmoji(weather?: string): string {
  if (!weather) return ''
  const key = normalizeWeatherId(weather)
  if ((WEATHER_IDS as readonly string[]).includes(key)) {
    return WEATHER_EMOJI[key as WeatherId]
  }
  return '🌤️'
}

export const DiarySchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.date(),
  content: z.string().min(1),
  tags: z.string().optional().nullable(),
  tagColors: z.record(z.string(), z.number()).optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  weather: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  locationDetail: z.string().optional().nullable(),
  isFavorite: z.boolean().default(false),
  mediaPaths: z.array(z.string()).default([])
})

export type Diary = z.infer<typeof DiarySchema>
export type CreateDiaryInput = Omit<z.input<typeof DiarySchema>, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateDiaryInput = Partial<CreateDiaryInput>

// ── UI 视图所需的数据结构 (从 Flutter 迁移) ──

export interface DiaryMeta {
  id: number
  date: Date
  preview: string
  tags: string[]
  updatedAt?: Date
  weather?: string
  mood?: string
  location?: string
  isFavorite?: boolean
  hasMedia?: boolean
  /** 从 frontmatter tag_colors 解析的标签配色 */
  tagColors?: Record<string, number>
}

/** 日记列表服务端筛选 / 分页参数 */
export interface DiaryListFilter {
  year?: number
  /** 1-12，与 year 同时传入时按月份筛选 */
  month?: number
  favorite?: boolean
  weathers?: string[]
  limit?: number
  offset?: number
  orderBy?: 'asc' | 'desc'
}

export interface TimelineNode {
  id: number | string
  type: 'month_separator' | 'diary_entry'
  date: Date
  meta?: DiaryMeta
}
