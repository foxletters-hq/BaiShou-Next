import type { StyleProp, ViewStyle } from 'react-native'
import type { GraphSearchMode } from '@baishou/shared'
import type { GraphRegisteredSameNameEntity } from '@/src/services/graph-name-candidates.util'
import type { GraphEditNameConflict } from './graph-screen.types'

/** 详情面板中一条「相关关系」的展示数据 */
export type GraphDetailEdgeItem = {
  edge: {
    id: string
    fromId: string
    toId: string
    edgeType?: string
    reviewStatus?: string
    sourceRef?: string | null
    sourceExcerpt?: string | null
  }
  partnerName: string
}

/** GraphScreenDetailPane 的对外 props 契约 */
export type GraphScreenDetailPaneProps = {
  fullPage?: boolean
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  selectedNode: any
  editName: string
  onEditNameChange: (value: string) => void
  editNameConflict: GraphEditNameConflict | null
  sameNameEntities: GraphRegisteredSameNameEntity[]
  editSummary: string
  onEditSummaryChange: (value: string) => void
  editAliases: string
  onEditAliasesChange: (value: string) => void
  busy: boolean
  onSaveNodeEdit: () => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void | Promise<void>
  onDeleteSelected: () => void
  onOpenSplit: () => void
  onRevertSplit: (discriminator: string) => void
  onSelectNode: (id: string) => void
  onMergeIntoExisting: (
    survivorId: string,
    survivorName: string,
    loserId: string,
    loserName: string
  ) => void
  detailEdges: GraphDetailEdgeItem[]
  onOpenSource: (ref: string | null | undefined, excerpt?: string | null) => void
  onReviewEdge: (
    edgeId: string,
    status: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => void | Promise<void>
  onDeleteEdge: (edgeId: string) => void
  addEdgeQuery: string
  onAddEdgeQueryChange: (value: string) => void
  onSearchAddEdgeTarget: (query?: string, mode?: GraphSearchMode) => void | Promise<void>
  addEdgeSearchMode?: GraphSearchMode
  onAddEdgeSearchModeChange?: (mode: GraphSearchMode) => void
  addEdgeSearching?: boolean
  addEdgeType: string
  onAddEdgeTypeChange: (value: string) => void
  addEdgeToId: string
  onAddEdgeToIdChange: (id: string) => void
  onAddEdge: () => void
  addEdgeHits: any[]
}
