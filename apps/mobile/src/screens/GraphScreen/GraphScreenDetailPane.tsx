import React from 'react'
import { ScrollView } from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphScreenDetailAddEdgeModal } from './GraphScreenDetailAddEdgeModal'
import { GraphScreenDetailEdgeSection } from './GraphScreenDetailEdgeSection'
import { GraphScreenDetailNodeSection } from './GraphScreenDetailNodeSection'
import { styles } from './GraphScreen.styles'
import type { GraphScreenDetailPaneProps } from './graph-screen-detail.types'

/**
 * 节点详情面板：只负责滚动容器与各区块的编排。
 * 节点编辑区、相关关系区、添加关系弹层分别由同目录子组件承载。
 */
export function GraphScreenDetailPane(props: GraphScreenDetailPaneProps) {
  const { colors } = useNativeTheme()
  const [addEdgeModalOpen, setAddEdgeModalOpen] = React.useState(false)

  return (
    <ScrollView
      style={[
        styles.detailPanel,
        props.fullPage && { maxHeight: undefined, flex: 1, borderBottomWidth: 0 },
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle
        },
        props.style
      ]}
      contentContainerStyle={[styles.detailPanelContent, props.contentContainerStyle]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <GraphScreenDetailNodeSection
        selectedNode={props.selectedNode}
        editName={props.editName}
        onEditNameChange={props.onEditNameChange}
        editNameConflict={props.editNameConflict}
        sameNameEntities={props.sameNameEntities}
        editSummary={props.editSummary}
        onEditSummaryChange={props.onEditSummaryChange}
        editAliases={props.editAliases}
        onEditAliasesChange={props.onEditAliasesChange}
        busy={props.busy}
        onSaveNodeEdit={props.onSaveNodeEdit}
        onReviewNode={props.onReviewNode}
        onDeleteSelected={props.onDeleteSelected}
        onOpenSplit={props.onOpenSplit}
        onRevertSplit={props.onRevertSplit}
        onSelectNode={props.onSelectNode}
        onMergeIntoExisting={props.onMergeIntoExisting}
      />

      <GraphScreenDetailEdgeSection
        selectedNode={props.selectedNode}
        detailEdges={props.detailEdges}
        busy={props.busy}
        onSelectNode={props.onSelectNode}
        onOpenSource={props.onOpenSource}
        onReviewEdge={props.onReviewEdge}
        onDeleteEdge={props.onDeleteEdge}
        onOpenAddEdge={() => setAddEdgeModalOpen(true)}
      />

      <GraphScreenDetailAddEdgeModal
        visible={addEdgeModalOpen}
        onClose={() => setAddEdgeModalOpen(false)}
        busy={props.busy}
        addEdgeQuery={props.addEdgeQuery}
        onAddEdgeQueryChange={props.onAddEdgeQueryChange}
        onSearchAddEdgeTarget={props.onSearchAddEdgeTarget}
        addEdgeSearchMode={props.addEdgeSearchMode}
        onAddEdgeSearchModeChange={props.onAddEdgeSearchModeChange}
        addEdgeSearching={props.addEdgeSearching}
        addEdgeType={props.addEdgeType}
        onAddEdgeTypeChange={props.onAddEdgeTypeChange}
        addEdgeToId={props.addEdgeToId}
        onAddEdgeToIdChange={props.onAddEdgeToIdChange}
        onAddEdge={props.onAddEdge}
        addEdgeHits={props.addEdgeHits}
      />
    </ScrollView>
  )
}
