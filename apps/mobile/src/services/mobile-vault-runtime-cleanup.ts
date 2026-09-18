import { VaultService } from '@baishou/core-mobile'
import { shadowConnectionManager, ShadowIndexRepository } from '@baishou/database'
import { deriveLegacyVaultId, logger } from '@baishou/shared'

/** 删除工作空间前清理其在全局 Shadow DB 中的索引 */
export async function deleteVaultWithShadowCleanup(
  vaultName: string,
  deps: {
    vaultService: VaultService
    /** Agent DB SQL 执行器；传入时先清派生数据再删目录 */
    agentDb?: import('@baishou/shared').ISqlExecutor | null
  }
): Promise<void> {
  await deps.vaultService.initRegistry()
  const vaultId =
    deps.vaultService.getAllVaults().find((v) => v.name === vaultName)?.id ??
    deriveLegacyVaultId(vaultName)
  if (deps.agentDb) {
    const { purgeVaultDerivedData } = await import('@baishou/database')
    const counts = await purgeVaultDerivedData(deps.agentDb, vaultId)
    logger.info('[VaultRuntime] purged agent.db derived data', { vaultName, vaultId, ...counts })
  }
  try {
    const { expoKnowledgeConnectionManager, KnowledgeRepository } =
      await import('@baishou/database/expo')
    if (expoKnowledgeConnectionManager.isConnected()) {
      const repo = new KnowledgeRepository(expoKnowledgeConnectionManager.getDb())
      const kbCounts = await repo.deleteAllForVault(vaultId)
      logger.info('[VaultRuntime] purged knowledge.db', { vaultName, vaultId, ...kbCounts })
    }
  } catch (e) {
    logger.warn('[VaultRuntime] purge knowledge.db failed:', e as Error)
  }
  if (shadowConnectionManager.isConnected()) {
    const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId)
    await shadowRepo.deleteAllForVault(vaultId)
  }
  await deps.vaultService.deleteVault(vaultName)
}

/** 全量归档恢复前清空 Shadow 索引，避免旧索引与全新磁盘内容不一致 */
export async function clearAllVaultShadowIndexes(vaultService: VaultService): Promise<void> {
  if (!shadowConnectionManager.isConnected()) return
  const db = shadowConnectionManager.getDb()
  for (const vault of vaultService.getAllVaults()) {
    const shadowRepo = new ShadowIndexRepository(db, vault.id)
    await shadowRepo.deleteAllForVault(vault.id)
  }
  logger.info('[VaultRuntime] Cleared shadow index for all vaults before archive restore resync')
}
