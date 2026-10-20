import { useCallback, useState } from 'react'
import type { TFunction } from 'i18next'
import type { VaultInfo } from '@baishou/ui/native'
import type { BaishouContextValue } from '../../../providers/baishou-provider/types'

type Toast = { showSuccess: (message: string) => void; showError: (message: string) => void }

/** 设置页的 Vault 列表与切换/删除/创建动作 */
export function useSettingsVaults(
  services: BaishouContextValue['services'],
  dbReady: boolean,
  toast: Toast,
  t: TFunction
) {
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null)

  const loadVaults = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      const allVaults = await services.vaultService.getAllVaults()
      const active = await services.vaultService.getActiveVault()
      setVaults(
        allVaults.map((v) => ({
          name: v.name,
          path: v.path,
          createdAt: v.createdAt,
          lastAccessedAt: v.lastAccessedAt
        }))
      )
      if (active) {
        setActiveVault({
          name: active.name,
          path: active.path,
          createdAt: active.createdAt,
          lastAccessedAt: active.lastAccessedAt
        })
      } else {
        setActiveVault(null)
      }
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }, [dbReady, services])

  const handleSwitchVault = async (name: string) => {
    if (!services || !dbReady) return
    if (activeVault?.name === name) return
    try {
      await services.switchVault(name)
      await loadVaults()
      toast.showSuccess(t('common.save_success'))
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleDeleteVault = async (name: string) => {
    if (!services || !dbReady) return
    try {
      await services.deleteVault(name)
      await loadVaults()
    } catch {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  const handleCreateVault = async (name: string) => {
    if (!services || !dbReady) return
    await services.switchVault(name)
    await loadVaults()
  }

  return {
    vaults,
    activeVault,
    loadVaults,
    handleSwitchVault,
    handleDeleteVault,
    handleCreateVault
  }
}
