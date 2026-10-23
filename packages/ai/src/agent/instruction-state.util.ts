import type { SessionRepository } from '@baishou/database'

export interface SkillCatalogEntry {
  name: string
  description?: string
}

/**
 * 会话级 instruction 基线。
 *
 * - `entries` 是「epoch 基线」：一旦写入就冻结，后续请求都用它渲染，保证 system prompt 前缀逐字节稳定。
 * - `deltas` 是基线之后发生的变更说明，追加在目录之后；超过上限才重建基线（此时才可能出现一次前缀失效）。
 */
export interface SkillsInstructionState {
  entries: SkillCatalogEntry[]
  deltas?: string[]
}

export interface InstructionStatePayload {
  version: 1
  skills?: SkillsInstructionState
}

/** 基线增量最多累积多少条；超过则重建基线 */
export const MAX_SKILL_INSTRUCTION_DELTAS = 5

/** 增量文本累计字符上限；超过则重建基线，避免无限膨胀 */
export const MAX_SKILL_INSTRUCTION_DELTA_CHARS = 1600

function normalizeEntries(entries: ReadonlyArray<SkillCatalogEntry>): SkillCatalogEntry[] {
  const map = new Map<string, SkillCatalogEntry>()
  for (const entry of entries) {
    const name = String(entry?.name ?? '').trim()
    if (!name) continue
    const description = String(entry?.description ?? '').trim()
    map.set(name, { name, description: description || undefined })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function normalizeSkillCatalog(
  entries: ReadonlyArray<SkillCatalogEntry> | undefined
): SkillCatalogEntry[] {
  return normalizeEntries(entries ?? [])
}

export function hashSkillCatalog(entries: ReadonlyArray<SkillCatalogEntry>): string {
  const text = JSON.stringify(normalizeEntries(entries))
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** 渲染 `<skills_catalog>` 内部正文（不含标签） */
export function renderSkillsCatalogLines(entries: ReadonlyArray<SkillCatalogEntry>): string[] {
  const normalized = normalizeEntries(entries)
  if (normalized.length === 0) return []
  return [
    'Available skills (name + description only). Call skill_read with the skill name to load the full body when you decide to use one. The user may also attach a skill with /name.',
    ...normalized.map((entry) => `- ${entry.name}: ${entry.description || 'No description'}`)
  ]
}

/** 渲染增量说明：新增 / 删除 / 描述变更 */
export function renderSkillsDelta(
  previous: ReadonlyArray<SkillCatalogEntry>,
  current: ReadonlyArray<SkillCatalogEntry>
): string | null {
  const before = new Map(normalizeEntries(previous).map((entry) => [entry.name, entry]))
  const after = new Map(normalizeEntries(current).map((entry) => [entry.name, entry]))

  const added: SkillCatalogEntry[] = []
  const changed: SkillCatalogEntry[] = []
  for (const [name, entry] of after) {
    const prev = before.get(name)
    if (!prev) {
      added.push(entry)
      continue
    }
    if ((prev.description ?? '') !== (entry.description ?? '')) changed.push(entry)
  }
  const removed: string[] = []
  for (const name of before.keys()) {
    if (!after.has(name)) removed.push(name)
  }

  if (added.length === 0 && removed.length === 0 && changed.length === 0) return null

  const lines = [
    'The available skills have changed. This update supersedes the previous skill list for the affected entries.'
  ]
  if (added.length > 0) {
    lines.push('New skills:')
    for (const entry of added) {
      lines.push(`- ${entry.name}: ${entry.description || 'No description'}`)
    }
  }
  if (changed.length > 0) {
    lines.push('Updated skills:')
    for (const entry of changed) {
      lines.push(`- ${entry.name}: ${entry.description || 'No description'}`)
    }
  }
  if (removed.length > 0) {
    lines.push(
      `The following skills are no longer available and must not be used: ${removed.join(', ')}.`
    )
  }
  return lines.join('\n')
}

export function parseInstructionState(raw: string | null | undefined): InstructionStatePayload {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return { version: 1 }
  try {
    const parsed = JSON.parse(raw) as InstructionStatePayload
    if (!parsed || typeof parsed !== 'object') return { version: 1 }
    return {
      version: 1,
      ...(parsed.skills && Array.isArray(parsed.skills.entries)
        ? {
            skills: {
              entries: normalizeEntries(parsed.skills.entries),
              ...(Array.isArray(parsed.skills.deltas) && parsed.skills.deltas.length > 0
                ? { deltas: parsed.skills.deltas.filter((d): d is string => typeof d === 'string') }
                : {})
            }
          }
        : {})
    }
  } catch {
    return { version: 1 }
  }
}

export function serializeInstructionState(state: InstructionStatePayload): string {
  return JSON.stringify({
    version: 1,
    ...(state.skills
      ? {
          skills: {
            entries: state.skills.entries,
            ...(state.skills.deltas && state.skills.deltas.length > 0
              ? { deltas: state.skills.deltas }
              : {})
          }
        }
      : {})
  })
}

export interface SkillsInstructionSection {
  /** 冻结的完整目录正文行 */
  catalog: string[]
  /** 基线之后追加的增量说明 */
  deltas: string[]
  /** 下一轮要持久化的状态；null 表示无需写库 */
  nextState: InstructionStatePayload | null
}

/**
 * 计算本轮要注入的 skills instruction：
 * - 首次：写入基线，整段目录进 system prompt。
 * - 列表未变：复用冻结基线（逐字节稳定）。
 * - 列表变化：只追加增量说明，基线保持不变；增量过多时才重建基线。
 */
export function resolveSkillsInstructionSection(
  currentCatalog: ReadonlyArray<SkillCatalogEntry> | undefined,
  storedRaw: string | null | undefined
): SkillsInstructionSection {
  const current = normalizeSkillCatalog(currentCatalog)
  const stored = parseInstructionState(storedRaw)

  if (!stored.skills) {
    return {
      catalog: renderSkillsCatalogLines(current),
      deltas: [],
      nextState: { version: 1, skills: { entries: current } }
    }
  }

  const frozen = stored.skills.entries
  const deltas = stored.skills.deltas ?? []
  const delta = renderSkillsDelta(frozen, current)

  if (!delta) {
    return {
      catalog: renderSkillsCatalogLines(frozen),
      deltas,
      nextState: null
    }
  }

  const nextDeltas = [...deltas, delta]
  const deltaChars = nextDeltas.reduce((total, item) => total + item.length, 0)
  if (
    nextDeltas.length > MAX_SKILL_INSTRUCTION_DELTAS ||
    deltaChars > MAX_SKILL_INSTRUCTION_DELTA_CHARS
  ) {
    return {
      catalog: renderSkillsCatalogLines(current),
      deltas: [],
      nextState: { version: 1, skills: { entries: current } }
    }
  }

  return {
    catalog: renderSkillsCatalogLines(frozen),
    deltas: nextDeltas,
    nextState: { version: 1, skills: { entries: frozen, deltas: nextDeltas } }
  }
}

/**
 * 读取会话级 instruction 状态并计算本轮 section，同时把新状态写回。
 * 仓库缺少相关方法（旧实现 / 测试桩）时退化为「每轮全量渲染」。
 */
export async function loadAndUpdateSkillsInstruction(input: {
  sessionRepo:
    | Pick<SessionRepository, 'getSessionInstructionState' | 'updateSessionInstructionState'>
    | undefined
  sessionId: string
  skillsCatalog: ReadonlyArray<SkillCatalogEntry> | undefined
}): Promise<{ catalog: string[]; deltas: string[] }> {
  const { sessionRepo, sessionId } = input
  const canPersist =
    sessionRepo != null &&
    typeof sessionRepo.getSessionInstructionState === 'function' &&
    typeof sessionRepo.updateSessionInstructionState === 'function'

  // 目录本身不可用（加载失败）时不要固化空基线，否则后续无法恢复
  if (!canPersist || !input.skillsCatalog) {
    return { catalog: renderSkillsCatalogLines(input.skillsCatalog ?? []), deltas: [] }
  }

  try {
    const storedRaw = await sessionRepo.getSessionInstructionState(sessionId)
    const section = resolveSkillsInstructionSection(input.skillsCatalog, storedRaw)
    if (section.nextState) {
      await sessionRepo.updateSessionInstructionState(
        sessionId,
        serializeInstructionState(section.nextState)
      )
    }
    return { catalog: section.catalog, deltas: section.deltas }
  } catch {
    return { catalog: renderSkillsCatalogLines(input.skillsCatalog ?? []), deltas: [] }
  }
}
