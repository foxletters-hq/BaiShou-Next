export const IDENTITY_RECENT_LIMIT = 5

export function updateRecentPersonaIds(
  recent: string[] | undefined,
  previousActiveId: string,
  nextActiveId: string
): string[] {
  const next = [
    previousActiveId,
    ...(recent ?? []).filter((id) => id !== previousActiveId && id !== nextActiveId)
  ]
  return next.slice(0, IDENTITY_RECENT_LIMIT)
}

export function renameRecentPersonaId(
  recent: string[] | undefined,
  oldId: string,
  newId: string
): string[] | undefined {
  if (!recent?.length) return recent
  return recent.map((id) => (id === oldId ? newId : id))
}

export function removeRecentPersonaId(
  recent: string[] | undefined,
  personaId: string
): string[] | undefined {
  if (!recent?.length) return recent
  const next = recent.filter((id) => id !== personaId)
  return next.length > 0 ? next : undefined
}

export function pickRecentPersonaIds(
  allPersonaIds: string[],
  activeId: string,
  recentPersonaIds?: string[]
): string[] {
  const picked: string[] = []

  for (const id of recentPersonaIds ?? []) {
    if (id === activeId || !allPersonaIds.includes(id) || picked.includes(id)) continue
    picked.push(id)
    if (picked.length >= IDENTITY_RECENT_LIMIT) return picked
  }

  for (const id of allPersonaIds) {
    if (id === activeId || picked.includes(id)) continue
    picked.push(id)
    if (picked.length >= IDENTITY_RECENT_LIMIT) break
  }

  return picked
}

export function pickQuickSwitchPersonaIds(
  allPersonaIds: string[],
  activeId: string,
  recentPersonaIds?: string[]
): string[] {
  const others = pickRecentPersonaIds(allPersonaIds, activeId, recentPersonaIds)
  return [activeId, ...others].slice(0, IDENTITY_RECENT_LIMIT)
}
