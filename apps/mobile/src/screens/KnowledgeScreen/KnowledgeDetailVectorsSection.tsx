import React, { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Card,
  CompactSearchBar,
  PageSizeSelector,
  Pagination,
  SegmentedContent,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'

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
  const { width } = useWindowDimensions()

  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize))
  const safeCurrentPage = Math.min(props.page, totalPages)
  const paginationInfo = useMemo(
    () =>
      (t('diary.pagination_info') || '')
        .replace('$total', String(props.total))
        .replace('$page', String(safeCurrentPage))
        .replace('$pages', String(totalPages)),
    [t, props.total, safeCurrentPage, totalPages]
  )

  return (
    <View
      style={{
        marginHorizontal: tokens.spacing.md,
        marginTop: tokens.spacing.sm,
        gap: tokens.spacing.sm
      }}
    >
      <View style={styles.searchToolbar}>
        <CompactSearchBar
          value={props.query}
          onChangeText={props.onQueryChange}
          onClear={() => props.onQueryChange('')}
          placeholder={t('knowledge.search_vectors_placeholder', '搜索片段')}
        />
        <View style={{ flexShrink: 0 }}>
          <SegmentedControl
            size="small"
            stretch={false}
            value={props.searchMode}
            onChange={(value) => props.onSearchModeChange(value as 'text' | 'semantic')}
            options={[
              { value: 'semantic', label: t('settings.rag_search_semantic', '语义搜索') },
              { value: 'text', label: t('settings.rag_search_text', '文本搜索') }
            ]}
          />
        </View>
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: mobileTypography.secondary.fontSize,
          fontWeight: mobileTypography.secondary.fontWeight
        }}
      >
        {t('knowledge.vector_stats', '{{count}} 个片段 · {{sources}} 个来源{{model}}', {
          count: props.total,
          sources: props.sourceCount ?? 0,
          model: props.modelId ? ` · ${props.modelId}` : ''
        })}
      </Text>
      <SegmentedContent value={props.searchMode}>
        {props.loading ? (
          <View
            style={{
              paddingVertical: tokens.spacing.xl,
              alignItems: 'center',
              justifyContent: 'center'
            }}
            accessibilityRole="progressbar"
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: mobileTypography.secondary.fontWeight,
                marginTop: tokens.spacing.mdTight
              }}
            >
              {t('settings.rag_searching', '正在搜索…')}
            </Text>
          </View>
        ) : (
          <View style={{ gap: tokens.spacing.sm }}>
            {props.items.map((item) => (
              <Pressable key={item.chunkId} onPress={() => props.onOpenChunk(item)}>
                <Card>
                  <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.xs }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.primary.fontSize,
                        fontWeight: mobileTypography.primary.fontWeight
                      }}
                    >
                      {item.sourceTitle || item.chunkId} · #{item.chunkIndex + 1}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize
                      }}
                      numberOfLines={4}
                    >
                      {item.chunkText}
                    </Text>
                    {item.score != null ? (
                      <Text
                        style={{
                          color: colors.textTertiary,
                          fontSize: mobileTypography.secondary.fontSize
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
                          fontSize: mobileTypography.secondary.fontSize
                        }}
                      >
                        {item.modelId}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            ))}
            {props.items.length === 0 ? (
              <View
                style={{
                  paddingVertical: tokens.spacing.xl,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {props.query.trim()
                    ? t('settings.no_search_results', '无匹配的搜索结果')
                    : t('knowledge.no_chunks', '暂无片段')}
                </Text>
              </View>
            ) : null}
            {(props.searchMode === 'text' || !props.query.trim()) && props.total > 0 ? (
              <View
                style={{
                  gap: tokens.spacing.smPlus,
                  paddingTop: tokens.spacing.md,
                  marginTop: tokens.spacing.xs,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: tokens.spacing.sm
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: colors.textTertiary,
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                    numberOfLines={1}
                  >
                    {paginationInfo}
                  </Text>
                  <PageSizeSelector
                    value={props.pageSize}
                    options={[10, 20, 50]}
                    label={t('diary.per_page', '条/页')}
                    onChange={(size) => {
                      props.onPageSizeChange(size)
                      props.onPageChange(1)
                    }}
                  />
                </View>
                {totalPages > 1 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    style={{ alignSelf: 'stretch' }}
                    contentContainerStyle={{
                      flexGrow: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      paddingVertical: tokens.spacing.xxs
                    }}
                  >
                    <Pagination
                      current={safeCurrentPage}
                      total={totalPages}
                      onChange={props.onPageChange}
                      siblingCount={width >= 400 ? 1 : 0}
                      showJumper
                      disabled={props.loading}
                    />
                  </ScrollView>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </SegmentedContent>
    </View>
  )
}
