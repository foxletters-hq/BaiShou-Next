import { z } from 'zod';

/** 天气值到 emoji 的映射表 */
export const WEATHER_EMOJI: Record<string, string> = {
  '晴': '☀️',
  '多云': '⛅',
  '阴': '☁️',
  '小雨': '🌦️',
  '大雨': '🌧️',
  '雪': '❄️',
  '雾': '🌫️',
  '风': '💨',
};

/** 根据天气值获取对应 emoji，无匹配时返回默认 🌤️ */
export function getWeatherEmoji(weather?: string): string {
  if (!weather) return '';
  return WEATHER_EMOJI[weather] || '🌤️';
}

export const DiarySchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.date(),
  content: z.string().min(1),
  tags: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  weather: z.string().optional().nullable(),
  mood: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  locationDetail: z.string().optional().nullable(),
  isFavorite: z.boolean().default(false),
  mediaPaths: z.array(z.string()).default([])
});

export type Diary = z.infer<typeof DiarySchema>;
export type CreateDiaryInput = Omit<z.input<typeof DiarySchema>, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDiaryInput = Partial<CreateDiaryInput>;

// ── UI 视图所需的数据结构 (从 Flutter 迁移) ──

export interface DiaryMeta {
  id: number;
  date: Date;
  preview: string;
  tags: string[];
  updatedAt?: Date;
  weather?: string;
  mood?: string;
  location?: string;
  isFavorite?: boolean;
}

export interface TimelineNode {
  id: number | string;
  type: 'month_separator' | 'diary_entry';
  date: Date;
  meta?: DiaryMeta;
}
