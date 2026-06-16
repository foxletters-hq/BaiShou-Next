import { useCallback, useEffect, useState } from 'react'

type IndexingStatus = {
  indexing: boolean
  resyncing: boolean
  shadowScanning: boolean
}

export function useStorageIndexing(): boolean {
  const [indexing, setIndexing] = useState(false)

  const refreshStatus = useCallback(async () => {
    const status = (await window.api?.vault?.getIndexingStatus?.()) as IndexingStatus | undefined
    if (status) {
      setIndexing(!!status.indexing)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()

    const api = window.api
    const unsubDiary = api?.diary?.onSyncEvent?.((event: { type?: string }) => {
      if (event?.type === 'indexing-started') {
        setIndexing(true)
        return
      }
      if (event?.type === 'indexing-complete' || event?.type === 'vault-resync-complete') {
        void refreshStatus()
      }
      if (event?.type === 'indexing-progress') {
        setIndexing(true)
      }
    })

    const unsubStorage = api?.storage?.onRootChanged?.(() => {
      setIndexing(true)
      void refreshStatus()
    })

    return () => {
      if (unsubDiary) unsubDiary()
      if (unsubStorage) unsubStorage()
    }
  }, [refreshStatus])

  return indexing
}
