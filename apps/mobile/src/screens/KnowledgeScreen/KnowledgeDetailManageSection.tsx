import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { NotebookDataManageAction } from '@baishou/shared'
import { Button, Checkbox, Input, SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeDetailManageSection(props: {
  graphNodes: KnowledgeGraphNodeRow[]
  graphEdges: KnowledgeGraphEdgeRow[]
  sourceCount: number
  manageAction: NotebookDataManageAction
  manageVector: boolean
  manageGraph: boolean
  clearPhrase: string
  phrase: string
  canConfirm: boolean
  busy: boolean
  onStartOrganize: () => void
  onRebuildGraph: () => void
  onManageAction: (v: NotebookDataManageAction) => void
  onToggleVector: () => void
  onToggleGraph: () => void
  onClearPhrase: (v: string) => void
  onConfirmManage: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const {
    graphNodes,
    graphEdges,
    sourceCount,
    manageAction,
    manageVector,
    manageGraph,
    clearPhrase,
    phrase,
    canConfirm,
    busy,
    onStartOrganize,
    onRebuildGraph,
    onManageAction,
    onToggleVector,
    onToggleGraph,
    onClearPhrase,
    onConfirmManage
  } = props

  return (
    <>
      <Text style={[styles.section, { color: colors.textPrimary, marginTop: 20 }]}>
        {t('knowledge.graph_panel', '本笔记本图谱')}
      </Text>
      {graphNodes.length === 0 ? (
        <View style={{ marginBottom: 12, gap: 8 }}>
          <Text style={{ color: colors.textSecondary }}>
            {t('knowledge.graph_empty_title', '还没有开始整理这本笔记本的关系')}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {sourceCount > 0
              ? t(
                  'knowledge.graph_empty_body',
                  '发现 {{count}} 个来源可以分析。整理后会显示人物、地点和事件关系；人生关系图不会被改动。',
                  { count: sourceCount }
                )
              : t(
                  'knowledge.graph_empty_no_sources',
                  '先导入资料，再开始整理这本笔记本里的关系。人生关系图是另一份数据，不会混进来。'
                )}
          </Text>
          <Button isDisabled={sourceCount === 0 || busy} onPress={() => void onStartOrganize()}>
            {t('graph.start_organize', '开始整理')}
          </Button>
        </View>
      ) : (
        graphEdges.slice(0, 8).map((e) => {
          const from = graphNodes.find((n) => n.id === e.fromId)?.name || e.fromId.slice(0, 6)
          const to = graphNodes.find((n) => n.id === e.toId)?.name || e.toId.slice(0, 6)
          return (
            <Text key={e.id} style={{ color: colors.textSecondary, marginTop: 4 }}>
              {from} —{e.edgeType}→ {to}
            </Text>
          )
        })
      )}
      <View style={{ marginBottom: 8 }}>
        <Button isDisabled={sourceCount === 0 || busy} onPress={() => void onRebuildGraph()}>
          {t('knowledge.rebuild_graph', '重新抽取图谱')}
        </Button>
      </View>

      <Text style={[styles.section, { color: colors.textPrimary, marginTop: 20 }]}>
        {t('knowledge.data_manage', '数据管理')}
      </Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
        {t(
          'knowledge.data_manage_reprocess_intro',
          '勾选要按当前模型重新整理的数据。可能耗时较长。'
        )}
      </Text>
      <SegmentedControl
        value={manageAction}
        onChange={onManageAction}
        options={[
          { value: 'reprocess', label: t('knowledge.data_manage_reprocess', '重整理') },
          { value: 'clear', label: t('knowledge.data_manage_clear', '清除') }
        ]}
      />
      <View style={{ marginTop: 12, gap: 8 }}>
        <Pressable style={styles.checkRow} onPress={onToggleVector}>
          <Checkbox selected={manageVector} onPress={onToggleVector} />
          <Text style={{ color: colors.textPrimary }}>
            {t('knowledge.data_manage_vector', '向量片段')}
          </Text>
        </Pressable>
        <Pressable style={styles.checkRow} onPress={onToggleGraph}>
          <Checkbox selected={manageGraph} onPress={onToggleGraph} />
          <Text style={{ color: colors.textPrimary }}>
            {t('knowledge.data_manage_graph', '本笔记本图谱')}
          </Text>
        </Pressable>
      </View>
      {manageAction === 'clear' ? (
        <Input
          value={clearPhrase}
          onChangeText={onClearPhrase}
          placeholder={phrase}
          containerStyle={{ marginTop: 8 }}
        />
      ) : null}
      <View style={{ marginTop: 12 }}>
        <Button
          isDisabled={!canConfirm || busy}
          destructive={manageAction === 'clear'}
          onPress={() => void onConfirmManage()}
        >
          {manageAction === 'clear'
            ? t('knowledge.data_manage_clear', '清除')
            : t('knowledge.data_manage_reprocess', '重整理')}
        </Button>
      </View>
    </>
  )
}
