import { z } from 'zod';

export const DiarySchema = z.object({
  id: z.number().int().positive().optional(),
  date: z.date(),
  content: z.string().min(1),
  tags: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

export type Diary = z.infer<typeof DiarySchema>;
export type CreateDiaryInput = Omit<Diary, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDiaryInput = Partial<CreateDiaryInput>;
