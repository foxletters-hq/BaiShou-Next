import { useCallback, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { deriveLegacyVaultId } from '@baishou/shared'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { getAgentDbRuntime } from '@/src/services/mobile-agent-db-runtime-ref'
import { mobileListSuspectNodes } from '@/src/services/mobile-graph-query'
import { readActiveVaultSafely } from '@/src/screens/MemoryCenterScreen/memory-center-data.util'

export function useMobileSuspectCount() {
  const { services, dbReady } = useBaishou()
  const [suspectCount, setSuspectCount] = useState(0)

  const refresh = useCallback(async () => {
    const runtime = getAgentDbRuntime()
    if (!dbReady || !services || !runtime?.drizzleDb) {
      setSuspectCount(0)
      return
    }
    const activeVault = readActiveVaultSafely(services.vaultService)
    const vaultId = activeVault?.id ?? deriveLegacyVaultId(activeVault?.name || 'Personal')
    try {
      const suspects = await mobileListSuspectNodes(runtime.drizzleDb, vaultId)
      setSuspectCount(Array.isArray(suspects) ? suspects.length : 0)
    } catch {
      setSuspectCount(0)
    }
  }, [dbReady, services])

  useFocusEffect(
    useCallback(() => {
      void refresh()
    }, [refresh])
  )

  return { suspectCount, refreshSuspects: refresh }
}
