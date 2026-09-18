import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatReasoningEffortLabel,
  getReasoningCatalogEpoch,
  listSessionReasoningEffortSettings,
  resolveReasoningEffortForSlot,
  subscribeReasoningCatalog,
  type GlobalModelsConfig,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { Select } from '@baishou/ui/native'
import {
  loadMobileSessionReasoningEffort,
  saveMobileSessionReasoningEffort
} from '@/src/services/mobile-reasoning-effort-session'
import { useBaishou } from '@/src/providers/BaishouProvider'

export function SessionReasoningSelect({
  sessionId,
  providerId,
  providerType,
  modelId
}: {
  sessionId: string | null
  providerId: string | null
  providerType?: string | null
  modelId: string | null
}) {
  const { t } = useTranslation()
  const { services, dbReady } = useBaishou()
  const catalogEpoch = useSyncExternalStore(
    subscribeReasoningCatalog,
    getReasoningCatalogEpoch,
    getReasoningCatalogEpoch
  )
  const [value, setValue] = useState<ReasoningEffortSetting>('auto')

  const effortOptions = useMemo(
    () =>
      listSessionReasoningEffortSettings(modelId || '', providerType || providerId || undefined),
    [catalogEpoch, modelId, providerId, providerType]
  )

  useEffect(() => {
    void (async () => {
      let fallback: ReasoningEffortSetting = 'auto'
      if (dbReady && services) {
        const models = await services.settingsManager.get<GlobalModelsConfig>('global_models')
        fallback = resolveReasoningEffortForSlot(models?.reasoningEffortBySlot, 'dialogue')
      }
      const next = await loadMobileSessionReasoningEffort(
        sessionId,
        providerId,
        modelId,
        fallback
      )
      setValue(effortOptions.includes(next) ? next : 'auto')
    })()
  }, [dbReady, effortOptions, modelId, providerId, services, sessionId])

  const selected = effortOptions.includes(value) ? value : 'auto'

  return (
    <View style={styles.wrap}>
      <Select
        value={selected}
        onValueChange={(next) => {
          const effort = next as ReasoningEffortSetting
          const nextValue = effortOptions.includes(effort) ? effort : 'auto'
          setValue(nextValue)
          void saveMobileSessionReasoningEffort(sessionId, providerId, modelId, nextValue)
        }}
        placeholder={t('agent.reasoning.effort_label', '思考强度')}
        options={effortOptions.map((opt) => ({
          value: opt,
          label: formatReasoningEffortLabel(opt)
        }))}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8 }
})
