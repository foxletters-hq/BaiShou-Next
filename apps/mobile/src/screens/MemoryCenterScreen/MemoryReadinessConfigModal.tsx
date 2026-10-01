import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { MemoryReadinessRow } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, ProviderBrandIcon, SettingsItem, useNativeTheme } from '@baishou/ui/native'
import {
  memoryProviderTypeOf,
  memoryReadinessRowLabel,
  memoryReadinessRowOpensModels,
  memoryReadinessRowValue,
  memoryVectorMetaLine
} from './memory-center-readiness-copy.util'

export function MemoryReadinessConfigModal(props: {
  visible: boolean
  rows?: MemoryReadinessRow[]
  providers?: ReadonlyArray<{ id: string; type?: string }>
  vectorCount: number
  dimension: number
  detectBusy: boolean
  onClose: () => void
  onConfigureModels: () => void
  onDetectDimension: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <Modal
      visible={props.visible}
      title={t('memory.view_current_config', '查看当前配置')}
      onClose={props.onClose}
    >
      <ScrollView>
        {(Array.isArray(props.rows) ? props.rows : []).map((row) => {
          const opensModels = memoryReadinessRowOpensModels(row.id)
          const providerType = memoryProviderTypeOf(props.providers, row.providerId)
          return (
            <SettingsItem
              key={row.id}
              style={{ paddingHorizontal: 0 }}
              title={memoryReadinessRowLabel(row.id, t)}
              subtitle={memoryReadinessRowValue(row, t)}
              onPress={opensModels ? props.onConfigureModels : undefined}
              icon={
                row.providerId ? (
                  <ProviderBrandIcon
                    providerId={row.providerId}
                    providerType={providerType}
                    size={18}
                  />
                ) : undefined
              }
              rightElement={
                opensModels ? (
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: settingsTypography.row.fontSize
                    }}
                  >
                    ›
                  </Text>
                ) : undefined
              }
            />
          )
        })}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize,
            marginTop: tokens.spacing.sm
          }}
        >
          {memoryVectorMetaLine(props.vectorCount, props.dimension, t)}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: tokens.spacing.sm,
            marginTop: tokens.spacing.md
          }}
        >
          <Button
            variant="outlined"
            isDisabled={props.detectBusy}
            onPress={props.onDetectDimension}
          >
            {t('settings.rag_detect_dimension', '检测维度')}
          </Button>
          <Button variant="outlined" onPress={props.onClose}>
            {t('common.close', '关闭')}
          </Button>
        </View>
      </ScrollView>
    </Modal>
  )
}
