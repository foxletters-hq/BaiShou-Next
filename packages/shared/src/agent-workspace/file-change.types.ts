import { z } from 'zod'

export const FileChangeKindSchema = z.enum(['create', 'modify', 'delete', 'rename'])

export type FileChangeKind = z.infer<typeof FileChangeKindSchema>

export const FileChangePartDataSchema = z.object({
  path: z.string(),
  kind: FileChangeKindSchema,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  preview: z.string().optional(),
  diff: z.string().optional(),
  toolCallId: z.string().optional(),
  roundCheckpointId: z.string().optional(),
  /** Present when kind is rename */
  previousPath: z.string().optional()
})

export type FileChangePartData = z.infer<typeof FileChangePartDataSchema>
