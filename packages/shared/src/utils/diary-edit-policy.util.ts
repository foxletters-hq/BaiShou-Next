export type DiaryEditMode = 'append' | 'overwrite'

export function isDiaryEditOverwriteMode(mode: string | undefined | null): boolean {
  return mode === 'overwrite'
}

export function resolveDiaryEditMode(mode?: string | null): DiaryEditMode {
  return isDiaryEditOverwriteMode(mode) ? 'overwrite' : 'append'
}
