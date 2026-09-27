import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  clampOcrConcurrency,
  formatExtractProbePagesList,
  listExtractProbeSources,
  listOcrConcurrencyValues,
  normalizeKnowledgeDefaultExtractEngine,
  type KnowledgeConfig
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Input,
  Select,
  SegmentedControl,
  SettingsSection,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

const OCR_LANGUAGE_PRESET_VALUES = [
  'chi_sim+eng',
  'chi_tra+eng',
  'jpn+eng',
  'eng',
  '__custom__'
] as const

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
  onProbe: () => void
  sources: Array<{
    id: string
    title: string
    sourceKind?: string | null
    relativePath?: string | null
    pageCount?: number | null
  }>
  probeSourceId: string
  onProbeSourceChange: (id: string) => void
  onPickVision: () => void
  onPickEmbedding?: () => void
  onPickGraphModel?: () => void
  ocrCapReason?: string
  visionCapReason?: string
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const engine = normalizeKnowledgeDefaultExtractEngine(props.engine)
  const pdfSources = listExtractProbeSources(props.sources)
  const probeSource = pdfSources.find((row) => row.id === props.probeSourceId) || pdfSources[0]
  const presetValue = props.ocrUseCustom
    ? '__custom__'
    : OCR_LANGUAGE_PRESET_VALUES.includes(
          props.ocrLanguage as (typeof OCR_LANGUAGE_PRESET_VALUES)[number]
        ) && props.ocrLanguage !== '__custom__'
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
        {props.ocrCapReason ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize
            }}
          >
            {t('knowledge.engine_ocr', '本地 OCR')} · {props.ocrCapReason}
          </Text>
        ) : null}
        {props.visionCapReason ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize
            }}
          >
            {t('knowledge.engine_vision', '视觉模型')} · {props.visionCapReason}
          </Text>
        ) : null}
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
              options={[
                {
                  value: 'chi_sim+eng',
                  label: t('knowledge.ocr_lang_chi_sim_eng', '简体中文 + English')
                },
                {
                  value: 'chi_tra+eng',
                  label: t('knowledge.ocr_lang_chi_tra_eng', '繁體中文 + English')
                },
                {
                  value: 'jpn+eng',
                  label: t('knowledge.ocr_lang_jpn_eng', '日本語 + English')
                },
                { value: 'eng', label: t('knowledge.ocr_lang_eng', 'English') },
                { value: '__custom__', label: t('knowledge.ocr_lang_custom', '自定义') }
              ]}
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
          <Button
            variant="outlined"
            isDisabled={props.busy}
            onPress={() => void props.onPickVision()}
          >
            {t('knowledge.vision_model', '视觉模型')}
          </Button>
          {props.onPickEmbedding ? (
            <Button
              variant="outlined"
              isDisabled={props.busy}
              onPress={() => void props.onPickEmbedding?.()}
            >
              {t('knowledge.embedding_model', '嵌入模型')}
            </Button>
          ) : null}
          {props.onPickGraphModel ? (
            <Button
              variant="outlined"
              isDisabled={props.busy}
              onPress={() => void props.onPickGraphModel?.()}
            >
              {t('knowledge.graph_model', '图抽取模型')}
            </Button>
          ) : null}
          <Select
            value={probeSource?.id || ''}
            onValueChange={props.onProbeSourceChange}
            options={pdfSources.map((source) => ({ value: source.id, label: source.title }))}
          />
          {probeSource ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.desc.fontSize
              }}
            >
              {t('knowledge.extract_probe_pages', '试抽页 {{pages}}', {
                pages: formatExtractProbePagesList(probeSource.pageCount) || '—'
              })}
            </Text>
          ) : (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: settingsTypography.desc.fontSize
              }}
            >
              {t('knowledge.probe_need_pdf', '试抽只支持 PDF，请先导入一份 PDF')}
            </Text>
          )}
          <Button
            variant="outlined"
            isDisabled={props.busy || pdfSources.length === 0}
            onPress={() => void props.onProbe()}
          >
            {t('knowledge.extract_probe', '试抽')}
          </Button>
        </View>
      </View>
    </SettingsSection>
  )
}
