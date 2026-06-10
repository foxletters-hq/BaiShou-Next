import { useCallback, useEffect, useRef, useState } from 'react'
import type { DiaryTemplateConfig } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

const EMPTY_DIARY_TEMPLATE_CONFIG: DiaryTemplateConfig = {}

let diaryTemplateConfigCache: DiaryTemplateConfig = EMPTY_DIARY_TEMPLATE_CONFIG

async function readDiaryTemplateConfig(
  get: <T>(key: string) => Promise<T | null>
): Promise<DiaryTemplateConfig> {
  return (await get<DiaryTemplateConfig>('diary_template_config')) || EMPTY_DIARY_TEMPLATE_CONFIG
}

export function useDiaryTemplateConfig(): {
  config: DiaryTemplateConfig
  hydrated: boolean
  saving: boolean
  persist: (next: DiaryTemplateConfig) => Promise<DiaryTemplateConfig>
  persistMerge: (partial: Partial<DiaryTemplateConfig>) => Promise<DiaryTemplateConfig>
  reload: () => Promise<DiaryTemplateConfig>
} {
  const { services } = useBaishou()
  const [config, setConfig] = useState<DiaryTemplateConfig>(diaryTemplateConfigCache)
  const [hydrated, setHydrated] = useState(false)
  const [saving, setSaving] = useState(false)
  const fetchEpochRef = useRef(0)

  const applyConfig = useCallback((next: DiaryTemplateConfig, epoch: number) => {
    if (epoch !== fetchEpochRef.current) return
    diaryTemplateConfigCache = next
    setConfig(next)
  }, [])

  const reload = useCallback(async (): Promise<DiaryTemplateConfig> => {
    if (!services) return diaryTemplateConfigCache
    try {
      const saved = await readDiaryTemplateConfig(
        services.settingsManager.get.bind(services.settingsManager)
      )
      const epoch = ++fetchEpochRef.current
      applyConfig(saved, epoch)
      setHydrated(true)
      return saved
    } catch {
      return diaryTemplateConfigCache
    }
  }, [applyConfig, services])

  useEffect(() => {
    if (!services) return
    const epoch = ++fetchEpochRef.current
    let cancelled = false
    void readDiaryTemplateConfig(services.settingsManager.get.bind(services.settingsManager))
      .then((saved) => {
        if (cancelled) return
        applyConfig(saved, epoch)
        setHydrated(true)
      })
      .catch(() => {
        if (cancelled) return
        setHydrated(true)
      })
    return () => {
      cancelled = true
    }
  }, [applyConfig, services])

  const writeConfig = useCallback(
    async (next: DiaryTemplateConfig): Promise<DiaryTemplateConfig> => {
      const epoch = ++fetchEpochRef.current
      if (!services) {
        applyConfig(next, epoch)
        setHydrated(true)
        return next
      }
      setSaving(true)
      try {
        await services.settingsManager.set('diary_template_config', next)
        applyConfig(next, epoch)
        setHydrated(true)
        return next
      } finally {
        setSaving(false)
      }
    },
    [applyConfig, services]
  )

  const persist = useCallback(
    async (next: DiaryTemplateConfig): Promise<DiaryTemplateConfig> => writeConfig(next),
    [writeConfig]
  )

  const persistMerge = useCallback(
    async (partial: Partial<DiaryTemplateConfig>): Promise<DiaryTemplateConfig> => {
      const latest = services
        ? await readDiaryTemplateConfig(services.settingsManager.get.bind(services.settingsManager))
        : diaryTemplateConfigCache
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
    [services, writeConfig]
  )

  return { config, hydrated, saving, persist, persistMerge, reload }
}
