import { notebookCoverImageCandidates, normalizeNotebookCoverImage } from '@baishou/shared'

export function listNotebookCoverCandidateRels(
  notebookId: string,
  recorded: string | null | undefined
): string[] {
  const recordedRel = normalizeNotebookCoverImage(notebookId, recorded)
  return recordedRel
    ? [
        recordedRel,
        ...notebookCoverImageCandidates(notebookId).filter((rel) => rel !== recordedRel)
      ]
    : notebookCoverImageCandidates(notebookId)
}
