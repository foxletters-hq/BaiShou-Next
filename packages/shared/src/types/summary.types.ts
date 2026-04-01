import { z } from 'zod';

export enum SummaryType {
  weekly = 'weekly',
  monthly = 'monthly',
  quarterly = 'quarterly',
  yearly = 'yearly',
}

export const SummaryTypeSchema = z.nativeEnum(SummaryType);

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

export interface MissingSummary {
  type: SummaryType;
  startDate: Date;
  endDate: Date;
  label: string;
  weekNumber?: number;
}

export interface ContextResult {
  text: string;
  yearCount: number;
  quarterCount: number;
  monthCount: number;
  weekCount: number;
  diaryCount: number;
}

