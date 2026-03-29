import { z } from 'zod';

export const SummaryTypeSchema = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);
export type SummaryType = z.infer<typeof SummaryTypeSchema>;

export const SummarySchema = z.object({
  id: z.number().int().positive().optional(),
  type: SummaryTypeSchema,
  startDate: z.date(),
  endDate: z.date(),
  content: z.string().min(1),
  sourceIds: z.string().optional().nullable(),
  generatedAt: z.date().optional()
});

export type Summary = z.infer<typeof SummarySchema>;
export type CreateSummaryInput = Omit<Summary, 'id' | 'generatedAt'>;
export type UpdateSummaryInput = Partial<CreateSummaryInput>;
