import type { RagConfig } from '@baishou/shared'

export type MemoryCenterActiveVault = {
  id?: string
  name?: string
}

/**
 * getActiveVault 是同步返回 VaultInfo | null，不能对返回值链式调用 .catch。
 * 用 try/catch 保留「读失败当没有活动仓库」的原意。
 */
export function readActiveVaultSafely(vaultService: {
  getActiveVault: () => MemoryCenterActiveVault | null
}): MemoryCenterActiveVault | null {
  try {
    return vaultService.getActiveVault()
  } catch {
    return null
  }
}

/**
 * 配置缺 ragEnabled 时按同仓其它读取点视为开启。
 * rag 整份缺失则保持 null，表示还没读到配置，而不是伪造一份开启态。
 */
export function normalizeMemoryCenterRagConfig(
  rag: { ragEnabled?: boolean } | null | undefined
): Pick<RagConfig, 'ragEnabled'> | null {
  if (rag == null) return null
  return { ragEnabled: rag.ragEnabled ?? true }
}
