import React, { useCallback, useEffect, useRef } from 'react'
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { Search, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  graphInventoryHasItems,
  type GraphInventoryNode,
  type GraphSearchMode
} from '@baishou/shared'
import {
  Card,
  DEFAULT_STROKE_WIDTH,
  Input,
  SegmentedContent,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { GraphScreenNodeList } from './GraphScreenNodeList'
import { graphScreenSectionStyles as styles } from './graph-screen-section.styles'
import type { GraphEmbeddedViewMode } from './graph-screen.types'

export function GraphScreenSearchSection(props: {
  query: string
  onQueryChange: (value: string) => void
  searchMode: GraphSearchMode
  onSearchModeChange: (mode: GraphSearchMode) => void
  onSearch: (queryOrMode?: string | GraphSearchMode, mode?: GraphSearchMode) => void
  searching: boolean
  listed: {
    items: GraphInventoryNode[]
    total: number
    page: number
    totalPages: number
    showPagination: boolean
  }
  nodeCount: number
  edgeCount: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onHitPress: (item: { id: string }) => void
  hideList?: boolean
  viewMode?: GraphEmbeddedViewMode
  onViewModeChange?: (mode: GraphEmbeddedViewMode) => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => clearDebounce()
  }, [clearDebounce])

  const handleQueryChange = useCallback(
    (text: string) => {
      clearDebounce()
      props.onQueryChange(text)
      if (!text.trim()) {
        props.onSearch('', props.searchMode)
        return
      }
      debounceTimerRef.current = setTimeout(() => {
        props.onSearch(text, props.searchMode)
      }, 250)
    },
    [clearDebounce, props]
  )

  const handleClear = useCallback(() => {
    clearDebounce()
    props.onQueryChange('')
    props.onSearch('', props.searchMode)
  }, [clearDebounce, props])

  const handleModeChange = useCallback(
    (mode: GraphSearchMode) => {
      clearDebounce()
      props.onSearchModeChange(mode)
      if (props.query.trim()) {
        props.onSearch(props.query, mode)
      }
    },
    [clearDebounce, props]
  )

  const handleSubmit = useCallback(() => {
    clearDebounce()
    props.onSearch(props.query, props.searchMode)
  }, [clearDebounce, props])

  const placeholder =
    props.searchMode === 'semantic'
      ? t('graph.search_placeholder_semantic', '语义搜索')
      : t('graph.search_placeholder_text', '搜索节点')

  const searchInput =
    Platform.OS === 'android' ? (
      <View style={styles.androidSearchRow}>
        <Search size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          value={props.query}
          onChangeText={handleQueryChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={handleSubmit}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel={t('common.search', '搜索')}
        />
        {props.query.length > 0 ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityLabel={t('common.clear', '清空')}
          >
            <X size={14} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          </TouchableOpacity>
        ) : null}
      </View>
    ) : (
      <Input
        bare
        className="min-h-0 flex-1 border-0 bg-transparent px-0"
        value={props.query}
        onChangeText={handleQueryChange}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        textAlignVertical="center"
        containerStyle={styles.searchInputWrap}
        style={[styles.searchInput, { color: colors.textPrimary }]}
        accessibilityLabel={t('common.search', '搜索')}
        leftSlot={
          <Search size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        }
        rightSlot={
          props.query.length > 0 ? (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
              accessibilityLabel={t('common.clear', '清空')}
            >
              <X size={14} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
            </TouchableOpacity>
          ) : undefined
        }
      />
    )

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('graph.search', '查找')}</Text>
      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderControl
            }
          ]}
        >
          {searchInput}
        </View>
        <SegmentedControl
          size="small"
          stretch={false}
          value={props.searchMode}
          onChange={handleModeChange}
          options={[
            { value: 'text', label: t('graph.search_text', '名称') },
            { value: 'semantic', label: t('graph.search_semantic', '语义') }
          ]}
        />
      </View>
      {props.viewMode && props.onViewModeChange ? (
        <SegmentedControl
          size="small"
          accessibilityLabel={t('graph.view_mode', '显示方式')}
          value={props.viewMode}
          onChange={(value) => props.onViewModeChange?.(value as GraphEmbeddedViewMode)}
          options={[
            { value: 'list', label: t('graph.view_list', '列表') },
            { value: 'graph', label: t('graph.view_graph', '关系图') }
          ]}
        />
      ) : null}
      {graphInventoryHasItems(props.nodeCount) ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('knowledge.graph_inventory', '已有节点 {{nodeCount}} · 关系 {{edgeCount}}', {
            nodeCount: props.nodeCount,
            edgeCount: props.edgeCount
          })}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t(
            'graph.inventory_empty_desc',
            '整理日记后，人物、地点和事件会出现在这里。可点开卡片查看节点。'
          )}
        </Text>
      )}
      {props.searching ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t('graph.searching', '正在搜索…')}
        </Text>
      ) : null}
      {props.hideList ? null : (
        <SegmentedContent value={props.searchMode}>
          <GraphScreenNodeList
            items={props.listed.items}
            total={props.listed.total}
            page={props.listed.page}
            pageSize={props.pageSize}
            totalPages={props.listed.totalPages}
            showPagination={props.listed.showPagination}
            query={props.query}
            onPageChange={props.onPageChange}
            onPageSizeChange={props.onPageSizeChange}
            onOpenNode={(id) => props.onHitPress({ id })}
          />
        </SegmentedContent>
      )}
    </Card>
  )
}
