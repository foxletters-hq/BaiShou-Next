import { getProviderIcon } from '@baishou/ui'

export function resolveNotebookProviderIconSrc(input: {
  providerId?: string | null
  providerType?: string | null
  isDark: boolean
}): string | undefined {
  const id = input.providerId?.trim() || ''
  const type = input.providerType?.trim() || ''
  return (
    (id ? getProviderIcon(id, input.isDark) : undefined) ||
    (type ? getProviderIcon(type, input.isDark) : undefined)
  )
}
