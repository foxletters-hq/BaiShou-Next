import {
  runCreateDemoVaultWorkflow,
  type DemoDiaryWriter,
  type DemoSummaryWriter
} from '@baishou/shared'
import { getDiaryManager } from '../ipc/diary.ipc'
import { getSummaryManager } from '../ipc/summary.ipc'
import { vaultService, notifyVaultRegistryUpdated, switchVaultFast } from '../ipc/vault.ipc'

export async function createDemoVaultWithData() {
  const result = await runCreateDemoVaultWorkflow({
    listVaultNames: () => vaultService.getAllVaults().map((vault) => vault.name),
    createVault: (name) => vaultService.createVault(name),
    activateVault: async (name) => {
      await switchVaultFast(name)
    },
    resolveWriters: async () => ({
      diaryWriter: getDiaryManager() as DemoDiaryWriter,
      summaryWriter: getSummaryManager() as DemoSummaryWriter
    })
  })

  notifyVaultRegistryUpdated()

  const { waitForVaultEcosystemResync } = await import('../services/vault-resync.service')
  await waitForVaultEcosystemResync()

  return result
}
