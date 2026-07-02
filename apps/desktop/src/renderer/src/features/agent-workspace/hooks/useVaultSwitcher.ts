import { useCallback, useEffect, useRef, useState } from 'react'
import { switchActiveVault, persistActiveVaultName } from '../../../lib/vault-runtime.util'

export interface VaultListItem {
  name: string
}

export function useVaultSwitcher() {
  const [vaults, setVaults] = useState<VaultListItem[]>([])
  const [activeVault, setActiveVault] = useState<VaultListItem | null>(null)
  const [isSwitchingVault, setIsSwitchingVault] = useState(false)
  const preloadedVaultsRef = useRef<Set<string>>(new Set())

  const fetchVaults = useCallback(async (): Promise<boolean> => {
    try {
      const vList = await (window as any).api?.vault?.list()
      const active = await (window as any).api?.vault?.getActive()
      if (Array.isArray(vList)) setVaults(vList)
      if (active?.name) {
        setActiveVault(active)
        persistActiveVaultName(active.name)
      }
      return Array.isArray(vList) && vList.length > 0
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    let retries = 0

    const pollVaults = async () => {
      if (cancelled) return
      const ready = await fetchVaults()
      if (ready || retries >= 60) return
      retries++
      timeoutId = setTimeout(pollVaults, 500)
    }

    void pollVaults()
    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [fetchVaults])

  useEffect(() => {
    const unsubRegistry = (window as any).api?.vault?.onRegistryUpdated?.(() => {
      void fetchVaults()
    })
    const unsubMutation = (window as any).api?.cache?.onDomainMutation?.((event: {
      domain?: string
      action?: string
    }) => {
      if (event.domain === 'vault' && event.action === 'switch') {
        void fetchVaults()
      }
    })
    return () => {
      unsubRegistry?.()
      unsubMutation?.()
    }
  }, [fetchVaults])

  const preloadVault = useCallback(
    (vaultName: string) => {
      if (!vaultName || vaultName === activeVault?.name) return
      if (preloadedVaultsRef.current.has(vaultName)) return
      preloadedVaultsRef.current.add(vaultName)
      void (window as any).api?.vault?.preload?.(vaultName)?.catch?.(() => {
        preloadedVaultsRef.current.delete(vaultName)
      })
    },
    [activeVault?.name]
  )

  const handleSwitchVault = useCallback(
    async (vaultName: string) => {
      if (isSwitchingVault || vaultName === activeVault?.name) return
      setIsSwitchingVault(true)
      try {
        await switchActiveVault(vaultName)
        await fetchVaults()
      } catch (e) {
        console.error(e)
      } finally {
        setIsSwitchingVault(false)
      }
    },
    [activeVault?.name, fetchVaults, isSwitchingVault]
  )

  return {
    vaults,
    activeVault,
    isSwitchingVault,
    fetchVaults,
    preloadVault,
    handleSwitchVault
  }
}
