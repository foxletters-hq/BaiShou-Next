/**
 * 模糊匹配 emoji：支持 ID（含/不含扩展名）、名称、子串匹配
 * 与 persist 层的 findEmojiById 逻辑保持一致
 */
export function resolvePendingEmoji(
  query: string,
  emojis: Array<{ id: string; name: string; relativePath: string }>
): { id: string; name: string; relativePath: string } | undefined {
  const normalizedQuery = query.trim().toLowerCase()

  const exactMatch = emojis.find(
    (e) => e.id === normalizedQuery || e.id.toLowerCase() === normalizedQuery
  )
  if (exactMatch) return exactMatch

  const idNoExtMatch = emojis.find(
    (e) => e.id.replace(/\.[^.]+$/, '').toLowerCase() === normalizedQuery
  )
  if (idNoExtMatch) return idNoExtMatch

  const normalizeName = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_\s]+/g, ' ')
      .trim()
  const normalizedNameQuery = normalizeName(normalizedQuery)
  const nameMatch = emojis.find((e) => normalizeName(e.name) === normalizedNameQuery)
  if (nameMatch) return nameMatch

  const idContainsMatch = emojis.find((e) =>
    e.id
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .includes(normalizedQuery)
  )
  if (idContainsMatch) return idContainsMatch

  const nameContainsMatch = emojis.find((e) => normalizeName(e.name).includes(normalizedNameQuery))
  if (nameContainsMatch) return nameContainsMatch

  return undefined
}
