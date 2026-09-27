import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Card,
  Input,
  PageSizeSelector,
  Pagination,
  SegmentedControl,
  SettingsSection,
  useNativeTheme
} from '@baishou/ui/native'

export type KnowledgeVectorChunkRow = {
  chunkId: string
  sourceTitle?: string | null
  chunkIndex: number
  chunkText: string
  modelId?: string | null
  score?: number
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
  onPageSizeChange: (size: number) => void
  onOpenChunk: (item: KnowledgeVectorChunkRow) => void
  sourceCount?: number
  modelId?: string | null
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
            : t('knowledge.vector_stats', '{{count}} 个片段 · {{sources}} 个来源{{model}}', {
                count: props.total,
                sources: props.sourceCount ?? 0,
                model: props.modelId ? ` · ${props.modelId}` : ''
              })}
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
                {item.score != null ? (
                  <Text
                    style={{
                      color: colors.textTertiary,
                      fontSize: settingsTypography.desc.fontSize
                    }}
                  >
                    {t('knowledge.vector_score', '相关度 {{score}}', {
                      score: item.score.toFixed(3)
                    })}
                  </Text>
                ) : null}
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
        {props.searchMode === 'text' ? (
          <>
            <PageSizeSelector
              value={props.pageSize}
              options={[10, 20, 50]}
              onChange={props.onPageSizeChange}
              label={t('knowledge.chunks_per_page', '条/页')}
            />
            {props.total > props.pageSize ? (
              <Pagination
                current={props.page}
                total={Math.max(1, Math.ceil(props.total / props.pageSize))}
                onChange={props.onPageChange}
                disabled={props.loading}
              />
            ) : null}
          </>
        ) : null}
      </View>
    </SettingsSection>
  )
}
