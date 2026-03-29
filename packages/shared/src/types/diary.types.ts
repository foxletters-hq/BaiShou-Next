import { z } from 'zod';

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
