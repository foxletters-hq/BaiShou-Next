export type IdentityFactEditError = 'empty' | 'duplicate'

export type IdentityFactEditResult =
  | { ok: true; facts: Record<string, string> }
  | { ok: false; error: IdentityFactEditError }

/** 写入或改名一条身份属性；空标签/内容和重名标签都拒绝 */
export function applyIdentityFactEdit(
  facts: Record<string, string>,
  editingKey: string | null,
  key: string,
  value: string
): IdentityFactEditResult {
  const nextKey = key.trim()
  const nextValue = value.trim()
  if (!nextKey || !nextValue) return { ok: false, error: 'empty' }
  if (nextKey !== editingKey && facts[nextKey]) return { ok: false, error: 'duplicate' }

  const nextFacts = { ...facts }
  if (editingKey && editingKey !== nextKey) {
    delete nextFacts[editingKey]
  }
  nextFacts[nextKey] = nextValue
  return { ok: true, facts: nextFacts }
}

export function deleteIdentityFact(
  facts: Record<string, string>,
  key: string
): Record<string, string> {
  const nextFacts = { ...facts }
  delete nextFacts[key]
  return nextFacts
}
