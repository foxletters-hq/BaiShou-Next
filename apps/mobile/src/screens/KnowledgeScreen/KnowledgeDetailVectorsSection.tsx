import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Card, Input, SettingsSection, useNativeTheme } from '@baishou/ui/native'

export type KnowledgeVectorChunkRow = {
  chunkId: string
  sourceTitle?: string | null
  chunkIndex: number
  chunkText: string
  modelId?: string | null
}

export function KnowledgeDetailVectorsSection(props: {
  query: string
  onQueryChange: (value: string) => void
  items: KnowledgeVectorChunkRow[]
  total: number
  loading: boolean
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <SettingsSection title={t('knowledge.tab_vectors', '向量')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        <Input
          value={props.query}
          onChangeText={props.onQueryChange}
          placeholder={t('knowledge.search_vectors', '搜索向量片段')}
        />
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: settingsTypography.desc.fontSize,
            fontWeight: settingsTypography.desc.fontWeight
          }}
        >
          {props.loading
            ? t('common.loading', '加载中…')
            : t('knowledge.vector_count', '{{count}} 个片段', { count: props.total })}
        </Text>
        {props.items.map((item) => (
          <Card key={item.chunkId}>
            <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.xs }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: settingsTypography.row.fontSize,
                  fontWeight: settingsTypography.row.fontWeight
                }}
              >
                {item.sourceTitle || item.chunkId} · #{item.chunkIndex + 1}
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: settingsTypography.desc.fontSize
                }}
                numberOfLines={4}
              >
                {item.chunkText}
              </Text>
              {item.modelId ? (
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: settingsTypography.desc.fontSize
                  }}
                >
                  {item.modelId}
                </Text>
              ) : null}
            </View>
          </Card>
        ))}
      </View>
    </SettingsSection>
  )
}
