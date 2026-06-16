import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryTemplateConfig } from '@baishou/shared'

const EMPTY_DIARY_TEMPLATE_CONFIG: DiaryTemplateConfig = {}

async function readDiaryTemplateConfig(): Promise<DiaryTemplateConfig> {
  const api = (window as any).api?.settings
  if (!api?.getDiaryTemplateConfig) return EMPTY_DIARY_TEMPLATE_CONFIG
  return (await api.getDiaryTemplateConfig()) || EMPTY_DIARY_TEMPLATE_CONFIG
}

export function useDiaryTemplateConfig(): {
  config: DiaryTemplateConfig
  hydrated: boolean
  saving: boolean
  persist: (next: DiaryTemplateConfig) => Promise<DiaryTemplateConfig>
  persistMerge: (partial: Partial<DiaryTemplateConfig>) => Promise<DiaryTemplateConfig>
  reload: () => Promise<DiaryTemplateConfig>
} {
  const [config, setConfig] = useState<DiaryTemplateConfig>(EMPTY_DIARY_TEMPLATE_CONFIG)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const fetchEpochRef = useRef(0)

  const applyConfig = useCallback((next: DiaryTemplateConfig, epoch: number) => {
    if (epoch !== fetchEpochRef.current) return
    setConfig(next)
    setHydrated(true)
  }, [])

  const reload = useCallback(async (): Promise<DiaryTemplateConfig> => {
    const epoch = ++fetchEpochRef.current
    const saved = await readDiaryTemplateConfig()
    applyConfig(saved, epoch)
    return saved
  }, [applyConfig])

  useEffect(() => {
    let cancelled = false
    void readDiaryTemplateConfig().then((saved) => {
      if (!cancelled) {
        setConfig(saved)
        setHydrated(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const writeConfig = useCallback(
    async (next: DiaryTemplateConfig): Promise<DiaryTemplateConfig> => {
      const epoch = ++fetchEpochRef.current
      const api = (window as any).api?.settings
      if (!api?.setDiaryTemplateConfig) {
        applyConfig(next, epoch)
        return next
      }
      setSaving(true)
      try {
        await api.setDiaryTemplateConfig(next)
        applyConfig(next, epoch)
        return next
      } finally {
        setSaving(false)
      }
    },
    [applyConfig]
  )

  const persist = useCallback(
    async (next: DiaryTemplateConfig): Promise<DiaryTemplateConfig> => writeConfig(next),
    [writeConfig]
  )

  const persistMerge = useCallback(
    async (partial: Partial<DiaryTemplateConfig>): Promise<DiaryTemplateConfig> => {
      const latest = await readDiaryTemplateConfig()
      const next: DiaryTemplateConfig = { ...latest }
      for (const [key, value] of Object.entries(partial) as Array<
        [keyof DiaryTemplateConfig, DiaryTemplateConfig[keyof DiaryTemplateConfig]]
      >) {
        if (value === undefined) {
          delete next[key]
        } else {
          next[key] = value
        }
      }
      return writeConfig(next)
    },
    [writeConfig]
  )

  return { config, hydrated, saving, persist, persistMerge, reload }
}
