import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { REASONING_EFFORTS, type ReasoningEffortSetting } from '@baishou/shared'
import { Select } from '@baishou/ui/native'
import {
  loadMobileSessionReasoningEffort,
  saveMobileSessionReasoningEffort
} from '@/src/services/mobile-reasoning-effort-session'

export function SessionReasoningSelect({
  sessionId,
  providerId,
  modelId
}: {
  sessionId: string | null
  providerId: string | null
  modelId: string | null
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState<ReasoningEffortSetting>('auto')

  useEffect(() => {
    void loadMobileSessionReasoningEffort(sessionId, providerId, modelId).then(setValue)
  }, [sessionId, providerId, modelId])

  return (
    <View style={styles.wrap}>
      <Select
        value={value}
        onValueChange={(next) => {
          const effort = next as ReasoningEffortSetting
          setValue(effort)
          void saveMobileSessionReasoningEffort(sessionId, providerId, modelId, effort)
        }}
        placeholder={t('agent.reasoning.effort_label', '思考强度')}
        options={[
          { value: 'auto', label: t('agent.reasoning.effort.auto', 'Default') },
          ...REASONING_EFFORTS.map((effort) => ({ value: effort, label: effort }))
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8 }
})
