/**
 * Per-diary extract cursor: exists (journal is here) × extracted (cursor written)
 * × needsReextract (body hash moved). Graph rows missing is not a bit —
 * user re-extracts that diary.
 */
export function resolveDiaryExtractBits(input: {
  contentHash: string | null | undefined
  extractedHash: string | null | undefined
}): { exists: boolean; extracted: boolean; needsReextract: boolean } {
  const contentHash = input.contentHash?.trim() ?? ''
  const extractedHash = input.extractedHash?.trim() || null
  if (!contentHash) {
    return { exists: false, extracted: extractedHash != null, needsReextract: false }
  }
  return {
    exists: true,
    extracted: extractedHash != null,
    needsReextract: extractedHash !== contentHash
  }
}
