/**
 * 仓库稳定 ID 工具 — 实现已迁至 `@baishou/shared`（供 database 回填共用）。
 * 本文件保留 re-export，避免打破既有 `@baishou/core` 导入路径。
 */

export {
  createRandomVaultId,
  deriveLegacyVaultId,
  isVaultId
} from '@baishou/shared'

import { deriveLegacyVaultId, isVaultId } from '@baishou/shared'

/** 将 vault 名称或 id 解析为 DB 写入/检索用的稳定 id。V2.3 IPC 将直接传 id。
 * 不做 trim/case-fold，与 deriveLegacyVaultId / 回填映射一致。
 */
export function resolveVaultIdForDb(nameOrId: string): string {
  return isVaultId(nameOrId) ? nameOrId : deriveLegacyVaultId(nameOrId)
}
