export type ProviderCatalogItem = {
  id: string
  name: string
  iconUrl?: string
  defaultBase?: string
  isSystem?: boolean
  sortOrder?: number
}

export type SortedProviderRow = ProviderCatalogItem & {
  sortOrder: number
  enabled: boolean
}

export function buildSortedProvidersList(
  catalog: ProviderCatalogItem[],
  providers: Record<string, { enabled?: boolean; sortOrder?: number }>
): SortedProviderRow[] {
  return catalog
    .map((item) => ({
      ...item,
      sortOrder: providers[item.id]?.sortOrder ?? item.sortOrder ?? 999,
      enabled: providers[item.id]?.enabled ?? false
    }))
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      return a.sortOrder - b.sortOrder
    })
}

export function areSameProviderRows(left: SortedProviderRow[], right: SortedProviderRow[]): boolean {
  if (left.length !== right.length) return false
  return left.every((row, index) => {
    const other = right[index]
    return (
      row.id === other.id &&
      row.name === other.name &&
      row.iconUrl === other.iconUrl &&
      row.enabled === other.enabled &&
      row.sortOrder === other.sortOrder &&
      row.isSystem === other.isSystem
    )
  })
}

/** 列表内容未变时沿用上一份引用，避免 sync effect 每轮 setState */
export function nextLocalProvidersList(
  previous: SortedProviderRow[],
  next: SortedProviderRow[]
): SortedProviderRow[] {
  return areSameProviderRows(previous, next) ? previous : next
}
