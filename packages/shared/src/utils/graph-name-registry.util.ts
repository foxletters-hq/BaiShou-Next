import { normalizeGraphName } from './graph-identity.util'

const NAME_REGISTRY_KEY = 'nameRegistry'
const AMBIGUOUS_SOURCE_REFS_KEY = 'ambiguousSourceRefs'
const MAX_AMBIGUOUS_SOURCE_REFS = 200

/**
 * 区分信息参与节点 ID 哈希，必须与名字同一套归一化，
 * 否则大小写或空白不同会被当成两个身份。
 */
export function normalizeGraphDiscriminator(raw?: string | null): string {
  return normalizeGraphName(raw ?? '')
}

export type GraphNameRegistryEntry = {
  discriminator: string
  label: string
  nodeId: string
  registeredAt: number
}

function isGraphNameRegistryEntry(value: unknown): value is GraphNameRegistryEntry {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.discriminator === 'string' &&
    typeof item.label === 'string' &&
    typeof item.nodeId === 'string' &&
    typeof item.registeredAt === 'number' &&
    Number.isFinite(item.registeredAt)
  )
}

function toGraphNameRegistryEntry(value: GraphNameRegistryEntry): GraphNameRegistryEntry {
  return {
    discriminator: value.discriminator,
    label: value.label,
    nodeId: value.nodeId,
    registeredAt: value.registeredAt
  }
}

export function readGraphNameRegistry(props: Record<string, unknown>): GraphNameRegistryEntry[] {
  const raw = props[NAME_REGISTRY_KEY]
  if (!Array.isArray(raw)) return []
  const entries: GraphNameRegistryEntry[] = []
  for (const item of raw) {
    if (!isGraphNameRegistryEntry(item)) continue
    entries.push(toGraphNameRegistryEntry(item))
  }
  return entries
}

export function upsertGraphNameRegistryEntry(
  props: Record<string, unknown>,
  entry: GraphNameRegistryEntry
): Record<string, unknown> {
  const discriminator = normalizeGraphDiscriminator(entry.discriminator)
  const nextEntry = toGraphNameRegistryEntry({ ...entry, discriminator })
  const current = readGraphNameRegistry(props)
  const index = current.findIndex(
    (item) => normalizeGraphDiscriminator(item.discriminator) === discriminator
  )
  const next = [...current]
  if (index >= 0) {
    next[index] = nextEntry
  } else {
    next.push(nextEntry)
  }
  return { ...props, [NAME_REGISTRY_KEY]: next }
}

export function removeGraphNameRegistryEntry(
  props: Record<string, unknown>,
  discriminator: string
): Record<string, unknown> {
  const key = normalizeGraphDiscriminator(discriminator)
  const next = readGraphNameRegistry(props).filter(
    (item) => normalizeGraphDiscriminator(item.discriminator) !== key
  )
  const result: Record<string, unknown> = { ...props }
  if (next.length === 0) {
    // 空数组也会被同步当成「还有登记」，撤回拆分后必须连键一起删掉
    delete result[NAME_REGISTRY_KEY]
  } else {
    result[NAME_REGISTRY_KEY] = next
  }
  return result
}

export function hasAmbiguousGraphName(props: Record<string, unknown>): boolean {
  // 裸名节点本身是第一个实体，登记里有一条就表示这个名字已经对应两个实体
  return readGraphNameRegistry(props).length > 0
}

export function listAmbiguousSourceRefs(props: Record<string, unknown>): string[] {
  const raw = props[AMBIGUOUS_SOURCE_REFS_KEY]
  if (!Array.isArray(raw)) return []
  const refs: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') refs.push(item)
  }
  return refs
}

export function appendAmbiguousSourceRef(
  props: Record<string, unknown>,
  sourceRef: string
): Record<string, unknown> {
  if (!sourceRef.trim()) {
    return { ...props }
  }
  const current = listAmbiguousSourceRefs(props)
  if (current.includes(sourceRef)) {
    return { ...props, [AMBIGUOUS_SOURCE_REFS_KEY]: [...current] }
  }
  const next = [...current, sourceRef]
  if (next.length > MAX_AMBIGUOUS_SOURCE_REFS) {
    next.splice(0, next.length - MAX_AMBIGUOUS_SOURCE_REFS)
  }
  return { ...props, [AMBIGUOUS_SOURCE_REFS_KEY]: next }
}
