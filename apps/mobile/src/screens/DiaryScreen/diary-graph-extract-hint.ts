/** Cross-screen hint after diary save: offer graph extract for one entry. */

export type DiaryGraphExtractHint = {
  filePath: string
  date: string
}

let hint: DiaryGraphExtractHint | null = null

export function setDiaryGraphExtractHint(next: DiaryGraphExtractHint | null): void {
  hint = next
}

export function peekDiaryGraphExtractHint(): DiaryGraphExtractHint | null {
  return hint
}

export function consumeDiaryGraphExtractHint(): DiaryGraphExtractHint | null {
  const current = hint
  hint = null
  return current
}
