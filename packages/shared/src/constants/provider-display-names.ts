const PROVIDER_DISPLAY_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  opencodego: 'OpenCode Go'
}

/** 将 provider id 转为用户可见名称（仅处理无法简单首字母大写的特例） */
export function resolveProviderDisplayName(providerId: string): string {
  const normalized = providerId.trim().toLowerCase()
  const override = PROVIDER_DISPLAY_NAME_OVERRIDES[normalized]
  if (override) return override
  if (!providerId) return providerId
  return providerId.charAt(0).toUpperCase() + providerId.slice(1)
}
