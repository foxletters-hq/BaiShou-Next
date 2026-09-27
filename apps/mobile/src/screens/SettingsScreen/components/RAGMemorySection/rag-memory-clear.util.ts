import type { TFunction } from 'i18next'
import {
  deriveLegacyVaultId,
  memoryClearVectorKindsOf,
  type MemoryClearKind
} from '@baishou/shared'
import { getAgentDbRuntime } from '../../../../services/mobile-agent-db-runtime-ref'
import type { RagMemorySectionCtx } from './useRagMemorySection.ctx'

export async function confirmMobileRagClearKinds(input: {
  kinds: MemoryClearKind[]
  phrase: string
  expectedPhrase: string
  services: RagMemorySectionCtx['services']
  t: TFunction
  toast: { showError: (message: string) => void; showSuccess: (message: string) => void }
  loadRagData: (
    q?: string,
    mode?: 'semantic' | 'text',
    page?: number,
    size?: number
  ) => Promise<void>
  pageSize: number
  setCurrentPage: (page: number) => void
  onAccepted: () => void
}): Promise<void> {
  const {
    kinds,
    phrase,
    expectedPhrase,
    services,
    t,
    toast,
    loadRagData,
    pageSize,
    setCurrentPage
  } = input
  if (!services?.ragService) return
  if (phrase.trim() !== expectedPhrase) {
    toast.showError(t('settings.rag_clear_all_mismatch'))
    return
  }
  if (kinds.length === 0) return
  input.onAccepted()
  try {
    const vectorKinds = memoryClearVectorKindsOf(kinds)
    if (vectorKinds.length > 0) {
      await services.ragService.clearKinds(kinds)
    }
    if (kinds.includes('life_graph')) {
      const runtime = getAgentDbRuntime()
      if (
        runtime?.drizzleDb &&
        services.vaultService &&
        services.pathService &&
        services.fileSystem
      ) {
        const { mobileClearLifeGraph } = await import('../../../../services/mobile-graph-mutate')
        const { mobileGraphExtractQueue } =
          await import('../../../../services/mobile-graph-extract-queue.service')
        const { ShadowIndexRepository, shadowConnectionManager } = await import('@baishou/database')
        const { readActiveVaultSafely } =
          await import('../../../MemoryCenterScreen/memory-center-data.util')
        const activeVault = readActiveVaultSafely(services.vaultService)
        const vaultName = activeVault?.name || 'Personal'
        const vaultId = activeVault?.id ?? deriveLegacyVaultId(vaultName)
        mobileGraphExtractQueue.stop()
        await mobileClearLifeGraph({
          vaultId,
          vaultName,
          drizzleDb: runtime.drizzleDb,
          shadowRepo: new ShadowIndexRepository(shadowConnectionManager.getDb(), vaultId),
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          stopExtract: () => mobileGraphExtractQueue.stop()
        })
      }
    }
    setCurrentPage(1)
    await loadRagData('', 'text', 1, pageSize)
    toast.showSuccess(t('settings.rag_clear_all'))
  } catch (e: unknown) {
    toast.showError(e instanceof Error ? e.message : t('settings.rag_operation_failed'))
  }
}
