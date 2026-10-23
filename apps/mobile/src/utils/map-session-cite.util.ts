import { normalizeFileCiteRefs, normalizeSkillCiteRefs } from '@baishou/shared'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 持久层 JSON 只能是 unknown，先校验再交给共享规范化函数。 */
export function parseUnknownSkillCiteRefs(
  value: unknown
): Array<{ command?: string; content?: string }> | undefined {
  if (!Array.isArray(value)) return undefined
  const refs: Array<{ command?: string; content?: string }> = []
  for (const item of value) {
    if (!isPlainObject(item)) continue
    refs.push({
      command: typeof item.command === 'string' ? item.command : undefined,
      content: typeof item.content === 'string' ? item.content : undefined
    })
  }
  return refs
}

type FileCiteRefsInput = Parameters<typeof normalizeFileCiteRefs>[0]

/** 持久层 JSON 只能是 unknown，逐项丢掉不合法形状后再交给共享规范化函数。 */
export function parseUnknownFileCiteRefs(value: unknown): FileCiteRefsInput {
  if (value == null) return value
  if (!Array.isArray(value)) return undefined
  const refs: Array<Exclude<NonNullable<FileCiteRefsInput>[number], null | undefined>> = []
  for (const item of value) {
    if (!isPlainObject(item)) continue
    const selectionRaw = item.selection
    const selection = isPlainObject(selectionRaw)
      ? {
          startLine:
            typeof selectionRaw.startLine === 'number' ? selectionRaw.startLine : undefined,
          endLine: typeof selectionRaw.endLine === 'number' ? selectionRaw.endLine : undefined
        }
      : undefined
    refs.push({
      ...(typeof item.relativePath === 'string' ? { relativePath: item.relativePath } : {}),
      ...(selection ? { selection } : {}),
      ...(typeof item.comment === 'string' ? { comment: item.comment } : {}),
      ...(typeof item.origin === 'string' ? { origin: item.origin } : {}),
      ...(typeof item.isDirectory === 'boolean' ? { isDirectory: item.isDirectory } : {})
    })
  }
  return refs
}

export function normalizeUnknownSkillCiteRefs(value: unknown) {
  return normalizeSkillCiteRefs(parseUnknownSkillCiteRefs(value))
}

export function normalizeUnknownFileCiteRefs(value: unknown) {
  return normalizeFileCiteRefs(parseUnknownFileCiteRefs(value))
}
