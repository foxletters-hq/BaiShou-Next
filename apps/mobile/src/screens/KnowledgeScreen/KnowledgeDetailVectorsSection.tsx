import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Input, SegmentedControl, SettingsSection, useNativeTheme } from '@baishou/ui/native'

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
  searchMode: 'text' | 'semantic'
  onSearchModeChange: (mode: 'text' | 'semantic') => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  items: KnowledgeVectorChunkRow[]
  total: number
  loading: boolean
  onOpenChunk: (item: KnowledgeVectorChunkRow) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  return (
    <SettingsSection title={t('knowledge.tab_vectors', '向量')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        <SegmentedControl
          value={props.searchMode}
          onChange={(value) => props.onSearchModeChange(value as 'text' | 'semantic')}
          options={[
            { value: 'text', label: t('knowledge.vector_search_text', '文本') },
            { value: 'semantic', label: t('knowledge.vector_search_semantic', '语义') }
          ]}
        />
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
          <Pressable key={item.chunkId} onPress={() => props.onOpenChunk(item)}>
          <Card>
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
          </Pressable>
        ))}
        {props.searchMode === 'text' && props.total > props.pageSize ? (
          <View style={{ flexDirection: 'row', gap: tokens.spacing.sm }}>
            <Button
              variant="outlined"
              isDisabled={props.loading || props.page <= 1}
              onPress={() => props.onPageChange(props.page - 1)}
            >
              {t('common.prev', '上一页')}
            </Button>
            <Button
              variant="outlined"
              isDisabled={props.loading || props.page * props.pageSize >= props.total}
              onPress={() => props.onPageChange(props.page + 1)}
            >
              {t('common.next', '下一页')}
            </Button>
          </View>
        ) : null}
      </View>
    </SettingsSection>
  )
}
