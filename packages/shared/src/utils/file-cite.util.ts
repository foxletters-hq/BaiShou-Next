import {
  fileMentionDisplayLabels,
  formatFileMentionLabel,
  isSafeWorkspaceRelativePath,
  type PromptFileRef,
  type PromptFileRefOrigin,
  type PromptFileSelection
} from './prompt-attachment-kind.util'

export type FileCiteRef = PromptFileRef

export type FileCiteSegment =
  | { type: 'text'; value: string }
  | {
      type: 'file'
      relativePath: string
      selection?: PromptFileSelection
      comment?: string
      origin?: PromptFileRefOrigin
    }

export function normalizeFileCiteRefs(
  refs:
    | Array<{
        relativePath?: string
        selection?: { startLine?: number; endLine?: number } | null
        comment?: string
        origin?: PromptFileRefOrigin | string
      } | null | undefined>
    | null
    | undefined
): FileCiteRef[] {
  if (!Array.isArray(refs) || refs.length === 0) return []
  return refs
    .map((ref) => {
      const relativePath = String(ref?.relativePath ?? '')
        .trim()
        .replace(/\\/g, '/')
      const start = ref?.selection?.startLine
      const end = ref?.selection?.endLine
      const selection =
        Number.isFinite(start) && Number.isFinite(end) && Number(start) >= 1 && Number(end) >= 1
          ? {
              startLine: Math.min(Number(start), Number(end)),
              endLine: Math.max(Number(start), Number(end))
            }
          : undefined
      const comment = typeof ref?.comment === 'string' ? ref.comment.trim() : ''
      return {
        relativePath,
        selection,
        comment: comment || undefined,
        origin: ref?.origin as PromptFileRefOrigin | undefined
      }
    })
    .filter((ref) => Boolean(ref.relativePath) && isSafeWorkspaceRelativePath(ref.relativePath))
}

function findFileCiteToken(
  text: string,
  cursor: number,
  ref: FileCiteRef
): { idx: number; token: string } | null {
  let best: { idx: number; token: string } | null = null
  for (const token of fileMentionDisplayLabels(ref)) {
    const idx = text.indexOf(token, cursor)
    if (idx < 0) continue
    if (
      !best ||
      idx < best.idx ||
      (idx === best.idx && token.length > best.token.length)
    ) {
      best = { idx, token }
    }
  }
  return best
}

export function splitTextByFileRefs(
  text: string,
  fileRefs: FileCiteRef[] | null | undefined
): FileCiteSegment[] {
  const raw = text ?? ''
  const refs = normalizeFileCiteRefs(fileRefs)
  if (!raw || !refs.length) {
    return raw ? [{ type: 'text', value: raw }] : []
  }

  const segments: FileCiteSegment[] = []
  let cursor = 0
  for (const ref of refs) {
    const found = findFileCiteToken(raw, cursor, ref)
    if (!found) continue
    if (found.idx > cursor) {
      segments.push({ type: 'text', value: raw.slice(cursor, found.idx) })
    }
    segments.push({
      type: 'file',
      relativePath: ref.relativePath,
      selection: ref.selection,
      comment: ref.comment,
      origin: ref.origin
    })
    cursor = found.idx + found.token.length
  }
  if (cursor < raw.length) {
    segments.push({ type: 'text', value: raw.slice(cursor) })
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: raw }]
}

export function resolveUserFileDisplay(
  text: string,
  fileRefs: FileCiteRef[] | null | undefined
): { text: string; fileRefs: FileCiteRef[]; segments: FileCiteSegment[] } {
  const refs = normalizeFileCiteRefs(fileRefs)
  const raw = text ?? ''

  if (!refs.length) {
    return {
      text: raw,
      fileRefs: refs,
      segments: raw ? [{ type: 'text', value: raw }] : []
    }
  }

  const interleaved = splitTextByFileRefs(raw, refs)
  if (interleaved.some((seg) => seg.type === 'file')) {
    return { text: raw, fileRefs: refs, segments: interleaved }
  }

  const citeText = refs.map((ref) => formatFileMentionLabel(ref)).join(' ')
  const segments: FileCiteSegment[] = [
    ...refs.map((ref) => ({
      type: 'file' as const,
      relativePath: ref.relativePath,
      selection: ref.selection,
      comment: ref.comment,
      origin: ref.origin
    })),
    ...(raw.trim() ? [{ type: 'text' as const, value: raw.trim() }] : [])
  ]

  return {
    text: raw.trim() ? `${citeText} ${raw.trim()}` : citeText,
    fileRefs: refs,
    segments
  }
}
