import { normalizeFileCiteRefs, splitTextByFileRefs, type FileCiteRef } from './file-cite.util'
import type { PromptFileRefOrigin, PromptFileSelection } from './prompt-attachment-kind.util'
import { resolveUserSkillDisplay, type SkillCiteRef } from './skill-cite.util'

export type UserCiteSegment =
  | { type: 'text'; value: string }
  | { type: 'skill'; command: string; content: string }
  | {
      type: 'file'
      relativePath: string
      selection?: PromptFileSelection
      comment?: string
      origin?: PromptFileRefOrigin
    }

export function resolveUserComposerCites(
  text: string,
  skillRefs?: SkillCiteRef[] | null,
  fileRefs?: FileCiteRef[] | null
): { segments: UserCiteSegment[]; hasCite: boolean } {
  const skillResolved = resolveUserSkillDisplay(text, skillRefs)
  const files = normalizeFileCiteRefs(fileRefs)
  const segments: UserCiteSegment[] = []

  for (const seg of skillResolved.segments) {
    if (seg.type === 'skill') {
      segments.push(seg)
      continue
    }
    segments.push(...splitTextByFileRefs(seg.value, files))
  }

  if (files.length > 0 && !segments.some((seg) => seg.type === 'file')) {
    return {
      segments: [
        ...files.map((ref) => ({
          type: 'file' as const,
          relativePath: ref.relativePath,
          selection: ref.selection,
          comment: ref.comment,
          origin: ref.origin
        })),
        ...segments
      ],
      hasCite: true
    }
  }

  return {
    segments,
    hasCite: segments.some((seg) => seg.type !== 'text')
  }
}
