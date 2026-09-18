import React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { translateGraphNodeType, type GraphSearchMode } from '@baishou/shared'
import { Input, useNativeTheme } from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'

export function GraphScreenSearchTab(props: {
  query: string
  onQueryChange: (value: string) => void
  searchMode: GraphSearchMode
  onSearchModeChange: (mode: GraphSearchMode) => void
  onSearch: (mode?: GraphSearchMode) => void
  searching: boolean
  hits: any[]
  onHitPress: (item: any) => void
  listPad: { padding: number; paddingBottom: number }
}) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()

  return (
    <>
      <View style={styles.searchRow}>
        <Input
          value={props.query}
          onChangeText={props.onQueryChange}
          placeholder={
            props.searchMode === 'semantic'
              ? t('graph.search_placeholder_semantic', '按意思搜索节点…')
              : t('graph.search_placeholder_text', '按名称 / 别名搜索')
          }
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void props.onSearch()}
          containerStyle={{ flex: 1 }}
        />
        <Pressable onPress={() => void props.onSearch()} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('common.search', '搜索')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.searchModeRow}>
        {(['semantic', 'text'] as const).map((mode) => {
          const active = props.searchMode === mode
          return (
            <Pressable
              key={mode}
              onPress={() => {
                props.onSearchModeChange(mode)
                if (props.query.trim()) void props.onSearch(mode)
              }}
              style={[
                styles.searchModeChip,
                {
                  backgroundColor: active ? colors.bgSurfaceHigh : colors.bgSurface,
                  borderColor: active ? colors.primary : colors.borderSubtle
                }
              ]}
            >
              <Text
                style={{
                  color: active ? colors.primary : colors.textSecondary,
                  fontWeight: active ? '600' : '400'
                }}
              >
                {mode === 'semantic'
                  ? t('graph.search_semantic', '语义搜索')
                  : t('graph.search_text', '文本搜索')}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <FlatList
        data={props.hits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={props.listPad}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>
            {props.searching
              ? t('graph.searching', '正在搜索…')
              : props.query.trim()
                ? props.searchMode === 'semantic'
                  ? t(
                      'graph.search_semantic_empty',
                      '没有语义相近的节点。没做向量的节点不会出现在语义搜索里。'
                    )
                  : t('graph.search_no_hits', '没有找到匹配的节点')
                : t('graph.search_empty', '输入关键词搜索图谱实体')}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void props.onHitPress(item)}
            style={[
              styles.card,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
            <GraphDiscriminatorLabel value={item.discriminator} />
            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
              {translateGraphNodeType(tr, item.nodeType)}
              {item.summary ? ` · ${item.summary}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </>
  )
}
