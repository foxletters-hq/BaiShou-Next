import React, { useMemo } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_INVENTORY_PAGE_SIZES,
  translateGraphNodeType,
  type GraphInventoryNode
} from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Card, PageSizeSelector, Pagination, useNativeTheme } from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'

export function GraphScreenNodeList(props: {
  items: GraphInventoryNode[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  showPagination: boolean
  query: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onOpenNode: (id: string) => void
}) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors, tokens } = useNativeTheme()
  const { width } = useWindowDimensions()
  const safeCurrentPage = Math.min(props.page, props.totalPages)
  const paginationInfo = useMemo(
    () =>
      (t('diary.pagination_info') || '')
        .replace('$total', String(props.total))
        .replace('$page', String(safeCurrentPage))
        .replace('$pages', String(props.totalPages)),
    [t, props.total, safeCurrentPage, props.totalPages]
  )

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      {props.items.map((item) => (
        <Pressable key={item.id} onPress={() => props.onOpenNode(item.id)}>
          <Card>
            <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.xs }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: mobileTypography.primary.fontSize,
                  fontWeight: mobileTypography.primary.fontWeight
                }}
              >
                {item.name}
              </Text>
              <GraphDiscriminatorLabel value={item.discriminator} />
              {item.nodeType || item.summary ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                  numberOfLines={4}
                >
                  {[translateGraphNodeType(tr, item.nodeType ?? ''), item.summary]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
              {item.mentionCount != null ? (
                <Text
                  style={{
                    color: colors.textTertiary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {t('graph.mention_count', '提及 {{count}} 次', { count: item.mentionCount })}
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
              : t('knowledge.graph_no_nodes', '暂无节点')}
          </Text>
        </View>
      ) : null}
      {props.showPagination ? (
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
              options={[...GRAPH_INVENTORY_PAGE_SIZES]}
              label={t('diary.per_page', '条/页')}
              onChange={(size) => {
                props.onPageSizeChange(size)
                props.onPageChange(1)
              }}
            />
          </View>
          {props.totalPages > 1 ? (
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
                total={props.totalPages}
                onChange={props.onPageChange}
                siblingCount={width >= 400 ? 1 : 0}
                showJumper
              />
            </ScrollView>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
