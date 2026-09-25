import React from 'react'
import { useTranslation } from 'react-i18next'
import { GraphIrreversibleConfirm, type GraphMergeConfirmTarget } from '../graph/GraphIrreversibleConfirm'
import { GraphMergeSearchModal, type GraphMergeSearchHit } from '../graph/GraphMergeSearchModal'
import { graphMergeSearchSeed } from '../graph/graph-page-view.util'
import type { NotebookGraphViewNode } from './notebook-graph-view.util'
import graphStyles from '../graph/GraphPage.module.css'

export function NotebookGraphOverlays(props: {
  mergeSearchOpen: boolean
  mergeConfirm: GraphMergeConfirmTarget | null
  mergeBusy: boolean
  selectedId: string | null
  selectedNode: NotebookGraphViewNode | null
  nodes: NotebookGraphViewNode[]
  searchMergeNodes: (input: {
    query: string
    nodeTypes?: string[]
    limit?: number
  }) => Promise<GraphMergeSearchHit[]>
  onCloseMergeSearch: () => void
  onRequestMerge: (target: GraphMergeConfirmTarget) => void
  onCancelMerge: () => void
  onConfirmMerge: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <GraphMergeSearchModal
        isOpen={props.mergeSearchOpen}
        seed={graphMergeSearchSeed({
          selectedId: props.selectedId,
          selectedNode: props.selectedNode,
          findNode: (id) => props.nodes.find((node) => node.id === id) ?? null,
          forbiddenNodeTypes: ['source']
        })}
        busy={props.mergeBusy}
        forbiddenAnchorTypes={['source']}
        searchNodes={props.searchMergeNodes}
        onClose={props.onCloseMergeSearch}
        onRequestMerge={props.onRequestMerge}
      />
      <GraphIrreversibleConfirm
        isOpen={!!props.mergeConfirm}
        title={t('graph.merge_nodes', '合并节点')}
        warning={t(
          'graph.merge_irreversible',
          '合并不可撤销。被合并节点会并入保留节点，关系改挂到保留节点，对端同步后只保留目标节点。'
        )}
        detail={
          props.mergeConfirm ? (
            <ul className={graphStyles.mergeConfirmList}>
              <li>
                {t('graph.merge_keep', '保留 · {{name}}', {
                  name: props.mergeConfirm.survivorName
                })}
              </li>
              {props.mergeConfirm.losers.map((node) => (
                <li key={node.id}>
                  {t('graph.merge_absorb', '并入 · {{name}}', { name: node.name })}
                </li>
              ))}
            </ul>
          ) : null
        }
        busy={props.mergeBusy}
        onCancel={props.onCancelMerge}
        onConfirm={() => void props.onConfirmMerge()}
      />
    </>
  )
}
