import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  clampOcrConcurrency,
  listOcrConcurrencyValues,
  normalizeKnowledgeDefaultExtractEngine,
  type KnowledgeConfig
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Input, Select, SegmentedControl, SettingsSection, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

const OCR_LANGUAGE_PRESETS = [
  { value: 'chi_sim+eng', label: '简体中文 + English' },
  { value: 'chi_tra+eng', label: '繁體中文 + English' },
  { value: 'jpn+eng', label: '日本語 + English' },
  { value: 'eng', label: 'English' },
  { value: '__custom__', label: '自定义' }
]

export function KnowledgeDetailExtractSection(props: {
  busy: boolean
  engine: KnowledgeConfig['defaultExtractEngine']
  ocrLanguage: string
  ocrConcurrency: number
  ocrUseCustom: boolean
  onEngineChange: (engine: 'ocr' | 'vision') => void
  onOcrLanguageChange: (value: string) => void
  onOcrCustomChange: (custom: boolean) => void
  onOcrConcurrencyChange: (value: number) => void
  onSave: () => void
  onRecoverStale: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const engine = normalizeKnowledgeDefaultExtractEngine(props.engine)
  const presetValue = props.ocrUseCustom
    ? '__custom__'
    : OCR_LANGUAGE_PRESETS.some((row) => row.value === props.ocrLanguage)
      ? props.ocrLanguage
      : '__custom__'

  return (
    <SettingsSection title={t('knowledge.settings_section_extract', '导入提取')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.label.fontSize,
            fontWeight: settingsTypography.label.fontWeight
          }}
        >
          {t('knowledge.default_engine', '默认提取方式')}
        </Text>
        <SegmentedControl
          value={engine === 'vision' ? 'vision' : 'ocr'}
          onChange={(value) => props.onEngineChange(value === 'vision' ? 'vision' : 'ocr')}
          options={[
            { value: 'ocr', label: t('knowledge.engine_ocr', '本地 OCR') },
            { value: 'vision', label: t('knowledge.engine_vision', '视觉模型') }
          ]}
        />
        {engine !== 'vision' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            <Select
              value={presetValue}
              onValueChange={(value) => {
                if (value === '__custom__') {
                  props.onOcrCustomChange(true)
                  return
                }
                props.onOcrCustomChange(false)
                props.onOcrLanguageChange(value)
              }}
              options={OCR_LANGUAGE_PRESETS.map((row) => ({
                value: row.value,
                label: row.label
              }))}
            />
            {presetValue === '__custom__' ? (
              <Input
                value={props.ocrLanguage}
                onChangeText={props.onOcrLanguageChange}
                placeholder="chi_sim+eng"
              />
            ) : null}
            <Select
              value={String(clampOcrConcurrency(props.ocrConcurrency))}
              onValueChange={(value) => props.onOcrConcurrencyChange(Number(value))}
              options={listOcrConcurrencyValues().map((value) => ({
                value: String(value),
                label: t('knowledge.ocr_concurrency_n', '{{count}} 页并发', { count: value })
              }))}
            />
          </View>
        ) : null}
        <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Button isDisabled={props.busy} onPress={() => void props.onSave()}>
            {t('common.save', '保存')}
          </Button>
          <Button
            variant="outlined"
            isDisabled={props.busy}
            onPress={() => void props.onRecoverStale()}
          >
            {t('knowledge.recover_stale', '回收卡住的任务')}
          </Button>
        </View>
      </View>
    </SettingsSection>
  )
}
