/** 发送时快照的 Skill 引用（展示 /command，正文留给模型） */
export type SkillCiteRef = {
  command: string
  content: string
}

export type SkillCiteSegment =
  | { type: 'text'; value: string }
  | { type: 'skill'; command: string; content: string }

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, '')
}

/** 将展示文案按 skillRefs 出现顺序切成文本段与可点击引用 */
export function splitTextBySkillRefs(
  text: string,
  skillRefs: SkillCiteRef[] | null | undefined
): SkillCiteSegment[] {
  const raw = text ?? ''
  if (!raw || !skillRefs?.length) {
    return raw ? [{ type: 'text', value: raw }] : []
  }

  const segments: SkillCiteSegment[] = []
  let cursor = 0

  for (const ref of skillRefs) {
    const command = normalizeCommand(ref.command)
    if (!command) continue
    const token = `/${command}`
    const idx = raw.indexOf(token, cursor)
    if (idx < 0) continue
    if (idx > cursor) {
      segments.push({ type: 'text', value: raw.slice(cursor, idx) })
    }
    segments.push({
      type: 'skill',
      command,
      content: typeof ref.content === 'string' ? ref.content : ''
    })
    cursor = idx + token.length
  }

  if (cursor < raw.length) {
    segments.push({ type: 'text', value: raw.slice(cursor) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: raw }]
}

function buildSegmentsFromSkillRefs(refs: SkillCiteRef[]): SkillCiteSegment[] {
  return refs.map((ref) => ({
    type: 'skill' as const,
    command: ref.command,
    content: ref.content
  }))
}

/**
 * 气泡展示用：是否显示 Skill 引用只看 skillRefs，不根据正文是否含 /command 决定。
 * 若展示文案里已有 /command，则按位置切开；否则直接用 refs 生成引用芯片，并附带非 Skill 展开正文的伴随文本。
 */
export function resolveUserSkillDisplay(
  text: string,
  skillRefs: SkillCiteRef[] | null | undefined
): { text: string; skillRefs: SkillCiteRef[]; segments: SkillCiteSegment[] } {
  const refs = normalizeSkillCiteRefs(skillRefs)
  const raw = text ?? ''

  if (!refs.length) {
    return {
      text: raw,
      skillRefs: refs,
      segments: raw ? [{ type: 'text', value: raw }] : []
    }
  }

  const interleaved = splitTextBySkillRefs(raw, refs)
  if (interleaved.some((seg) => seg.type === 'skill')) {
    return { text: raw, skillRefs: refs, segments: interleaved }
  }

  const citeText = refs.map((ref) => `/${ref.command}`).join(' ')
  const expandedBodies = new Set(refs.map((ref) => ref.content.trim()).filter(Boolean))
  const companion = raw.trim() && !expandedBodies.has(raw.trim()) ? raw.trim() : ''
  const segments: SkillCiteSegment[] = [
    ...buildSegmentsFromSkillRefs(refs),
    ...(companion ? [{ type: 'text' as const, value: companion }] : [])
  ]

  return {
    text: companion ? `${citeText} ${companion}` : citeText,
    skillRefs: refs,
    segments
  }
}

export function normalizeSkillCiteRefs(
  refs: Array<{ command?: string; content?: string }> | null | undefined
): SkillCiteRef[] {
  if (!Array.isArray(refs) || refs.length === 0) return []
  return refs
    .map((ref) => ({
      command: normalizeCommand(String(ref?.command ?? '')),
      content: typeof ref?.content === 'string' ? ref.content : ''
    }))
    .filter((ref) => Boolean(ref.command))
}
