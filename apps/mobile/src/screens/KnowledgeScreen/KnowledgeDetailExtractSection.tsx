import React from 'react'
import { Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Image as ImageIcon } from 'lucide-react-native'
import {
  clampOcrConcurrency,
  listExtractProbeSources,
  listOcrConcurrencyValues,
  RECOMMENDED_OCR_CONCURRENCY
} from '@baishou/shared'
import { iconSizes, mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, HelpTooltip, Select, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

export function KnowledgeDetailExtractSection(props: {
  busy: boolean
  probing?: boolean
  onSave: () => void
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
  visionModelName?: string
  onSelectVisionModel?: () => void
  ocrConcurrency: number
  onOcrConcurrencyChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pdfSources = listExtractProbeSources(props.sources)
  const probeSource = pdfSources.find((row) => row.id === props.probeSourceId) || pdfSources[0]

  const labelStyle = {
    color: colors.textPrimary,
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: mobileTypography.secondary.fontWeight,
    lineHeight: 20
  } as const

  const displayVisionModel =
    props.visionModelName?.trim() || t('knowledge.follow_chat_model', '跟随对话模型')

  return (
    <View style={{ gap: tokens.spacing.md, paddingBottom: tokens.spacing.xs }}>
      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <Text style={labelStyle}>{t('knowledge.default_engine', '默认提取方式')}</Text>
          <HelpTooltip
            content={[
              t(
                'knowledge.settings_section_extract_help_mobile',
                '能直接读的文字就按文件抽取。PDF 一律交给视觉模型识图。'
              ),
              t(
                'knowledge.vision_model_recommend',
                '推荐选带看图能力的便宜多模态模型，扫描件抽字不必用最贵的。'
              )
            ].join('\n\n')}
          />
        </View>
        <TouchableOpacity
          activeOpacity={props.onSelectVisionModel ? 0.7 : 1}
          onPress={props.onSelectVisionModel}
          accessibilityRole="button"
          accessibilityLabel={`${t('knowledge.engine_vision_short', '视觉模型')}: ${displayVisionModel}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.borderControl,
            borderRadius: tokens.radius.md,
            paddingHorizontal: tokens.spacing.mdSnug,
            paddingVertical: tokens.spacing.mdTight,
            minHeight: 44,
            gap: tokens.spacing.sm
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.sm,
              flexShrink: 0
            }}
          >
            <ImageIcon size={18} color={colors.textSecondary} strokeWidth={1.75} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: '500',
                lineHeight: 20
              }}
            >
              {t('knowledge.engine_vision_short', '视觉模型')}
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing.xs,
              flexShrink: 1,
              justifyContent: 'flex-end'
            }}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: '400',
                lineHeight: 20,
                flexShrink: 1,
                textAlign: 'right'
              }}
            >
              {displayVisionModel}
            </Text>
            {props.onSelectVisionModel ? (
              <Text
                style={{
                  color: colors.textTertiary,
                  fontSize: iconSizes.md,
                  fontWeight: '300'
                }}
              >
                ›
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <Text style={labelStyle}>{t('knowledge.ocr_concurrency', '识图并发')}</Text>
          <HelpTooltip
            content={t(
              'knowledge.ocr_concurrency_hint_mobile',
              '同时识图的页数，范围 1–10。推荐 3。PDF 页图仍会排队渲染，识图请求可以并行。'
            )}
          />
        </View>
        <Select
          variant="settings"
          value={String(props.ocrConcurrency)}
          onValueChange={(value) =>
            props.onOcrConcurrencyChange(clampOcrConcurrency(Number(value)))
          }
          options={listOcrConcurrencyValues().map((n) => ({
            value: String(n),
            label:
              n === RECOMMENDED_OCR_CONCURRENCY
                ? t('knowledge.ocr_concurrency_option_recommended', '{{count}} 页（推荐）', {
                    count: n
                  })
                : t('knowledge.ocr_concurrency_option', '{{count}} 页', { count: n })
          }))}
        />
      </View>

      <View style={{ gap: tokens.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.xs }}>
          <Text style={labelStyle}>{t('knowledge.extract_probe_test', '抽取测试')}</Text>
          <HelpTooltip
            content={t(
              'knowledge.extract_probe_help',
              '选一份已导入的 PDF，用上方当前抽取方式试抽第 1 页、中间页和最后一页。只展示文字，不会写入资料或嵌入。'
            )}
          />
        </View>
        <Select
          variant="settings"
          value={probeSource?.id || ''}
          onValueChange={props.onProbeSourceChange}
          placeholder={t('knowledge.select_source_placeholder', '选择要测试的资料')}
          emptyText={t('knowledge.no_sources', '暂无资料')}
          options={pdfSources.map((source) => ({ value: source.id, label: source.title }))}
        />
      </View>

      <View style={[styles.submitActionsRow, modalActionsStyle, { marginTop: 0 }]}>
        <Button
          size="sm"
          variant="outlined"
          isDisabled={props.busy || pdfSources.length === 0}
          isLoading={props.probing}
          onPress={() => void props.onProbe()}
        >
          {props.probing
            ? t('knowledge.extract_probe_running', '正在试抽…')
            : t('knowledge.extract_probe_test', '抽取测试')}
        </Button>
        <Button size="sm" isDisabled={props.busy} onPress={() => void props.onSave()}>
          {t('common.save', '保存')}
        </Button>
      </View>
    </View>
  )
}
