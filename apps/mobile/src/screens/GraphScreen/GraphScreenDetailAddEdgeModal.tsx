import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  translateGraphEdgeType,
  translateGraphNodeType,
  type GraphSearchMode
} from '@baishou/shared'
import { GRAPH_EDGE_TYPES } from '@baishou/database'
import {
  Button,
  CompactSearchBar,
  FloatingModal,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'
import type { GraphScreenDetailPaneProps } from './graph-screen-detail.types'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type AddEdgeModalProps = Pick<
  GraphScreenDetailPaneProps,
  | 'busy'
  | 'addEdgeQuery'
  | 'onAddEdgeQueryChange'
  | 'onSearchAddEdgeTarget'
  | 'addEdgeSearchMode'
  | 'onAddEdgeSearchModeChange'
  | 'addEdgeSearching'
  | 'addEdgeType'
  | 'onAddEdgeTypeChange'
  | 'addEdgeToId'
  | 'onAddEdgeToIdChange'
  | 'onAddEdge'
  | 'addEdgeHits'
> & {
  visible: boolean
  onClose: () => void
}

/** 「添加关系」弹层：关系类型选择、目标节点防抖搜索与提交 */
export function GraphScreenDetailAddEdgeModal(props: AddEdgeModalProps) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()
  const {
    addEdgeQuery,
    onAddEdgeQueryChange,
    onAddEdgeToIdChange,
    onSearchAddEdgeTarget,
    onAddEdgeSearchModeChange
  } = props
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchMode = props.addEdgeSearchMode ?? 'text'

  const triggerSearch = React.useCallback(
    (query: string, mode: GraphSearchMode) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      void onSearchAddEdgeTarget(query, mode)
    },
    [onSearchAddEdgeTarget]
  )

  const handleQueryChange = React.useCallback(
    (text: string) => {
      onAddEdgeQueryChange(text)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
      searchTimerRef.current = setTimeout(() => {
        triggerSearch(text, searchMode)
      }, 250)
    },
    [onAddEdgeQueryChange, triggerSearch, searchMode]
  )

  const handleClear = React.useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    onAddEdgeQueryChange('')
    onAddEdgeToIdChange('')
    triggerSearch('', searchMode)
  }, [onAddEdgeQueryChange, onAddEdgeToIdChange, triggerSearch, searchMode])

  const handleModeChange = React.useCallback(
    (mode: GraphSearchMode) => {
      onAddEdgeSearchModeChange?.(mode)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      triggerSearch(addEdgeQuery, mode)
    },
    [onAddEdgeSearchModeChange, triggerSearch, addEdgeQuery]
  )

  const handleSubmit = React.useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    triggerSearch(addEdgeQuery, searchMode)
  }, [triggerSearch, addEdgeQuery, searchMode])

  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [])

  if (!props.visible) return null

  return (
    <FloatingModal visible={props.visible} onClose={props.onClose} maxWidth={420}>
      <View style={{ padding: sharedTokens.spacing.md, gap: sharedTokens.spacing.smPlus }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: '700'
            }}
          >
            {t('graph.add_edge', '添加关系')}
          </Text>
          <TouchableOpacity onPress={props.onClose} hitSlop={8}>
            <X size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.addEdgeTypeRow}>
          {GRAPH_EDGE_TYPES.map((et) => {
            const active = props.addEdgeType === et
            return (
              <Pressable
                key={et}
                onPress={() => props.onAddEdgeTypeChange(et)}
                style={[
                  styles.addEdgeTypeChip,
                  {
                    backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                    borderColor: active ? colors.primary : colors.borderControl
                  }
                ]}
              >
                <Text
                  style={[
                    styles.addEdgeTypeChipText,
                    {
                      color: active ? colors.textOnPrimary : colors.textSecondary,
                      fontWeight: active ? '700' : '500'
                    }
                  ]}
                >
                  {translateGraphEdgeType(tr, et)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.addEdgeSearchToolbar}>
          <CompactSearchBar
            value={props.addEdgeQuery}
            onChangeText={handleQueryChange}
            onClear={handleClear}
            onSubmitEditing={handleSubmit}
            placeholder={
              searchMode === 'semantic'
                ? t('graph.search_placeholder_semantic', '按意思搜索目标节点…')
                : t('graph.search_placeholder_text', '按名称 / 别名搜索')
            }
            style={styles.addEdgeSearchBox}
            rightSlot={
              props.addEdgeSearching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : undefined
            }
          />
          <SegmentedControl
            size="small"
            stretch={false}
            value={searchMode}
            onChange={(val) => handleModeChange(val as GraphSearchMode)}
            options={[
              { value: 'text', label: t('graph.search_text', '文本搜索') },
              { value: 'semantic', label: t('graph.search_semantic', '语义搜索') }
            ]}
          />
        </View>

        <ScrollView
          style={{ maxHeight: 200 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {!props.addEdgeSearching &&
          props.addEdgeQuery.trim() !== '' &&
          props.addEdgeHits.length === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.caption.fontSize,
                textAlign: 'center',
                paddingVertical: sharedTokens.spacing.sm
              }}
            >
              {t('graph.search_no_results', '未找到匹配的节点')}
            </Text>
          ) : null}
          {props.addEdgeHits.map((h) => {
            const active = props.addEdgeToId === h.id
            return (
              <Pressable
                key={h.id}
                onPress={() => props.onAddEdgeToIdChange(h.id)}
                style={[
                  styles.hitBtn,
                  {
                    backgroundColor: active ? colors.bgSurfaceNormal : 'transparent',
                    borderColor: active ? colors.primary : colors.borderControl,
                    marginBottom: sharedTokens.spacing.xs
                  }
                ]}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: '600'
                  }}
                >
                  {h.name}
                </Text>
                <GraphDiscriminatorLabel value={h.discriminator} />
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.caption.fontSize
                  }}
                >
                  {translateGraphNodeType(tr, h.nodeType)}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: sharedTokens.spacing.sm
          }}
        >
          <Button size="sm" variant="outlined" onPress={props.onClose}>
            {t('common.cancel', '取消')}
          </Button>
          <Button
            size="sm"
            isDisabled={props.busy || !props.addEdgeToId}
            onPress={async () => {
              await props.onAddEdge()
              props.onClose()
            }}
          >
            {t('graph.add_edge_submit', '添加')}
          </Button>
        </View>
      </View>
    </FloatingModal>
  )
}
