import type { InsertSessionInput } from '@baishou/database'

/** 移动端创建会话时的默认字段（DB upsert 亦有兜底，此处满足 TS） */
export function buildInsertSessionInput(
  partial: Pick<InsertSessionInput, 'id'> & Partial<Omit<InsertSessionInput, 'id'>>,
  activeVaultId = 'default'
): InsertSessionInput {
  return {
    vaultId: partial.vaultId ?? activeVaultId,
    providerId: partial.providerId ?? 'default',
    modelId: partial.modelId ?? 'default',
    ...partial
  }
}
