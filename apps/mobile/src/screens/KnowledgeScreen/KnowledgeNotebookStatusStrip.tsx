import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { FileText, Image as ImageIcon, ScanText, Settings, Sparkles } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { ProviderBrandIcon, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { pairStatusRows } from './knowledge-screen.util'

export function KnowledgeNotebookStatusStrip(props: {
  embeddingLabel: string
  graphLabel: string
  visionLabel: string
  extractEngineLabel: string
  sourceCount: number
  embeddingConfigured: boolean
  graphConfigured: boolean
  visionConfigured: boolean
  embeddingProviderId?: string
  graphProviderId?: string
  visionProviderId?: string
  modelsLoading?: boolean
  onPickEmbedding?: () => void
  onPickGraph?: () => void
  onPickVision?: () => void
  onOpenSettings?: () => void
  onOpenDataManage?: () => void
  onOpenManage?: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const missing = t('common.not_configured', '未配置')
  const loading = t('common.loading', '加载中...')
  const rows = [
    {
      key: 'embedding',
      label: t('knowledge.embedding_model', '嵌入模型'),
      value: props.modelsLoading
        ? loading
        : props.embeddingConfigured
          ? props.embeddingLabel
          : missing,
      warn: !props.modelsLoading && !props.embeddingConfigured,
      icon:
        props.embeddingConfigured && props.embeddingProviderId ? (
          <ProviderBrandIcon providerId={props.embeddingProviderId} size={16} />
        ) : (
          <Sparkles size={16} color={colors.textTertiary} strokeWidth={1.75} />
        ),
      onPress: props.onPickEmbedding
    },
    {
      key: 'graph',
      label: t('knowledge.graph_model', '图抽取模型'),
      value: props.modelsLoading ? loading : props.graphConfigured ? props.graphLabel : missing,
      warn: !props.modelsLoading && !props.graphConfigured,
      icon:
        props.graphConfigured && props.graphProviderId ? (
          <ProviderBrandIcon providerId={props.graphProviderId} size={16} />
        ) : (
          <Sparkles size={16} color={colors.textTertiary} strokeWidth={1.75} />
        ),
      onPress: props.onPickGraph
    },
    {
      key: 'vision',
      label: t('knowledge.vision_model', '视觉模型'),
      value: props.visionConfigured
        ? props.visionLabel
        : t('knowledge.follow_chat_model', '跟随对话模型'),
      warn: false,
      icon:
        props.visionConfigured && props.visionProviderId ? (
          <ProviderBrandIcon providerId={props.visionProviderId} size={16} />
        ) : (
          <ImageIcon size={16} color={colors.textSecondary} strokeWidth={1.75} />
        ),
      onPress: props.onPickVision
    },
    {
      key: 'engine',
      label: t('knowledge.default_engine', '默认提取方式'),
      value: props.extractEngineLabel,
      warn: false,
      icon: <ScanText size={16} color={colors.textSecondary} strokeWidth={1.75} />,
      onPress: props.onOpenSettings
    },
    {
      key: 'sources',
      label: t('knowledge.sources_panel', '来源'),
      value: t('knowledge.source_count_short', '{{count}} 个', { count: props.sourceCount }),
      warn: false,
      icon: <FileText size={16} color={colors.textSecondary} strokeWidth={1.75} />,
      onPress: undefined
    },
    {
      key: 'manage',
      label: '',
      value: t('knowledge.manage_settings_data', '设置与数据'),
      warn: false,
      icon: <Settings size={16} color={colors.textSecondary} strokeWidth={1.75} />,
      onPress: props.onOpenManage ?? props.onOpenSettings
    }
  ] as const

  return (
    <View
      style={[
        styles.statusStrip,
        {
          marginHorizontal: tokens.spacing.md,
          marginTop: tokens.spacing.sm,
          marginBottom: tokens.spacing.sm,
          padding: tokens.spacing.sm,
          gap: tokens.spacing.sm,
          backgroundColor: colors.bgSurface,
          borderRadius: tokens.radius.md,
          borderWidth: 1,
          borderColor: colors.borderMuted
        }
      ]}
    >
      {pairStatusRows(rows).map((pair) => (
        <View
          key={pair.map((row) => row.key).join('-')}
          style={[styles.statusPair, { gap: tokens.spacing.sm }]}
        >
          {pair.map((row) => {
            const body = (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.xs,
                  flex: 1,
                  minWidth: 0
                }}
              >
                {row.icon ? (
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {row.icon}
                  </View>
                ) : null}
                <View style={styles.statusMeta}>
                  {row.label ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.caption.fontSize,
                        fontWeight: mobileTypography.caption.fontWeight
                      }}
                      numberOfLines={1}
                    >
                      {row.label}
                    </Text>
                  ) : null}
                  <Text
                    style={{
                      color: row.warn ? colors.warning : colors.textPrimary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: mobileTypography.secondary.fontWeight
                    }}
                    numberOfLines={1}
                  >
                    {row.value}
                  </Text>
                </View>
              </View>
            )
            const itemStyle = [
              styles.statusItem,
              {
                gap: tokens.spacing.xs,
                paddingVertical: tokens.spacing.xs,
                paddingHorizontal: tokens.spacing.sm,
                borderWidth: 1,
                borderRadius: tokens.radius.md,
                backgroundColor: colors.bgSurface,
                borderColor: row.warn ? colors.warning : colors.borderMuted
              }
            ]
            if (row.onPress) {
              return (
                <Pressable
                  key={row.key}
                  onPress={row.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={row.label ? `${row.label} ${row.value}` : row.value}
                  style={itemStyle}
                >
                  {body}
                </Pressable>
              )
            }
            return (
              <View key={row.key} style={itemStyle}>
                {body}
              </View>
            )
          })}
          {pair.length === 1 ? (
            <View
              style={[
                styles.statusItem,
                {
                  gap: tokens.spacing.xs,
                  paddingVertical: tokens.spacing.xs,
                  paddingHorizontal: tokens.spacing.sm,
                  borderWidth: 1,
                  borderColor: 'transparent',
                  opacity: 0
                }
              ]}
              pointerEvents="none"
            />
          ) : null}
        </View>
      ))}
    </View>
  )
}
