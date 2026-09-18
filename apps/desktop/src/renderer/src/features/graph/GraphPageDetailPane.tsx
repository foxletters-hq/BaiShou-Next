import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_FOCUS_DEPTH_OPTIONS,
  asGraphTranslateFn,
  listAmbiguousSourceRefs,
  translateGraphEdgeType,
  translateGraphNodeType,
  type GraphFocusDepth
} from '@baishou/shared'
import { Button, Input, Select } from '@baishou/ui'
import type { GraphEditNameConflict, GraphNameCandidate, GraphPageNode } from './graph-page.types'
import { parseGraphNodeProps, readGraphNodeSuspectReason } from './graph-page-view.util'
import styles from './GraphPage.module.css'

export function GraphPageDetailPane(props: {
  selectedNode: GraphPageNode | null
  focusDepth: GraphFocusDepth
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  editName: string
  onEditNameChange: (value: string) => void
  editNameConflict: GraphEditNameConflict | null
  onSelectNode: (id: string) => void
  onMergeIntoExisting: (survivorId: string, loserId: string) => void
  editSummary: string
  onEditSummaryChange: (value: string) => void
  editAliases: string
  onEditAliasesChange: (value: string) => void
  nameCandidates: GraphNameCandidate[]
  busy: boolean
  onSaveNodeEdit: () => void
  onDeleteSelectedNode: () => void
  onOpenSplit: () => void
  onRevertSplit: (discriminator: string) => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  addEdgeQuery: string
  onAddEdgeQueryChange: (value: string) => void
  onSearchAddEdgeTarget: () => void
  addEdgeType: string
  onAddEdgeTypeChange: (value: string) => void
  edgeTypes: string[]
  addEdgeToId: string
  onAddEdgeToIdChange: (id: string) => void
  onAddEdge: () => void
  addEdgeHits: Array<{ id: string; name?: string; nodeType?: string }>
  detailEdges: Array<{
    edge: {
      id: string
      edgeType?: string
      reviewStatus?: string
      sourceRef?: string | null
      sourceExcerpt?: string | null
    }
    partnerName: string
  }>
  onOpenSource: (ref: string | null | undefined, excerpt?: string | null) => void
  onDeleteEdge: (edgeId: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  if (!props.selectedNode) {
    return (
      <div className={styles.empty}>{t('graph.click_node_for_detail', '点击画布节点查看详情')}</div>
    )
  }
  const selectedNode = props.selectedNode
  return (
    <>
      <div className={styles.detailDepthRow}>
        <div className={styles.detailDepthMeta}>
          <span className={styles.detailLabel}>{t('graph.focus_depth', '展开等级')}</span>
          <span className={styles.detailDepthHint}>
            {t('graph.focus_depth_hint_short', '高亮周围几级关系')}
          </span>
        </div>
        <div
          className={styles.depthSeg}
          role="radiogroup"
          aria-label={t('graph.focus_depth', '展开')}
        >
          {GRAPH_FOCUS_DEPTH_OPTIONS.map((d) => {
            const active = props.focusDepth === d
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                className={`${styles.depthBtn} ${active ? styles.depthBtnActive : ''}`}
                onClick={() => props.onFocusDepthChange(d)}
              >
                {d}
                {t('graph.focus_depth_unit', '级')}
              </button>
            )
          })}
        </div>
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.nodeIdentity}>
          <div className={styles.detailValue}>{selectedNode.name}</div>
          {selectedNode.discriminator ? (
            <span className={styles.discriminatorTag}>{selectedNode.discriminator}</span>
          ) : null}
        </div>
        <div className={styles.detailLabel}>{t('graph.label_name', '名称')}</div>
        <Input
          fieldSize="small"
          value={props.editName}
          onChange={(e) => props.onEditNameChange(e.target.value)}
        />
        {props.editNameConflict ? (
          <div className={styles.sameNameBanner}>
            {t(
              'graph.same_name_exists_edit',
              '已有同类型同名节点「{{name}}」。保存前请换名，或合并到该节点。',
              { name: props.editNameConflict.name }
            )}
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => void props.onSelectNode(props.editNameConflict!.id)}
              >
                {t('graph.open_existing_node', '打开已有节点')}
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() =>
                  props.onMergeIntoExisting(props.editNameConflict!.id, selectedNode.id)
                }
              >
                {t('graph.merge_into_existing', '合并到该节点')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_type', '类型')}</div>
        <div className={styles.detailValue}>
          {translateGraphNodeType(tr, selectedNode.nodeType)}
        </div>
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_summary', '摘要')}</div>
        <textarea
          className={styles.editArea}
          value={props.editSummary}
          onChange={(e) => props.onEditSummaryChange(e.target.value)}
          rows={3}
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_aliases', '别名')}</div>
        <Input
          fieldSize="small"
          value={props.editAliases}
          onChange={(e) => props.onEditAliasesChange(e.target.value)}
          placeholder={t('graph.aliases_placeholder', '逗号分隔')}
        />
      </div>
      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.label_review', '审核')}</div>
        <div className={styles.detailValue}>
          {selectedNode.reviewStatus || 'approved'}
          {selectedNode.origin === 'user' ? ` · ${t('graph.origin_user', '手工修正')}` : ''}
        </div>
      </div>
      {(() => {
        const ambiguousRefs = listAmbiguousSourceRefs(parseGraphNodeProps(selectedNode))
        if (selectedNode.discriminator || ambiguousRefs.length === 0) return null
        return (
          <div className={styles.sameNameBanner}>
            {t('graph.ambiguous_sources_hint', '有 {{count}} 条出处待确认归谁', {
              count: ambiguousRefs.length
            })}
          </div>
        )
      })()}
      {(() => {
        const suspectReason = readGraphNodeSuspectReason(selectedNode)
        if (!suspectReason) return null
        return (
          <div className={styles.sameNameBanner}>
            <div className={styles.detailLabel}>{t('graph.suspect_reason', '怀疑理由')}</div>
            <div className={styles.detailValue}>{suspectReason}</div>
          </div>
        )
      })()}
      {props.nameCandidates.some((item) => item.nodeId !== selectedNode.id) ? (
        <div className={styles.detailBlock}>
          <div className={styles.detailLabel}>
            {t('graph.same_name_siblings', '同名的其他实体')}
          </div>
          {props.nameCandidates
            .filter((item) => item.nodeId !== selectedNode.id)
            .map((item) => (
              <div key={item.nodeId} className={styles.siblingRow}>
                <div className={styles.siblingMain}>
                  <span className={styles.detailValue}>{item.name}</span>
                  {item.discriminator ? (
                    <span className={styles.discriminatorTag}>
                      {item.label || item.discriminator}
                    </span>
                  ) : (
                    <span className={styles.discriminatorTag}>
                      {t('graph.bare_entity', '原实体')}
                    </span>
                  )}
                </div>
                <div className={styles.rowActions}>
                  <Button type="button" onClick={() => void props.onSelectNode(item.nodeId)}>
                    {t('graph.open_sibling', '打开')}
                  </Button>
                  {item.discriminator ? (
                    <Button
                      type="button"
                      disabled={props.busy}
                      onClick={() => void props.onRevertSplit(item.discriminator)}
                    >
                      {t('graph.revert_split', '撤回拆分')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
        </div>
      ) : null}
      <div className={styles.rowActions}>
        <Button
          type="button"
          disabled={props.busy || !!props.editNameConflict}
          onClick={() => void props.onSaveNodeEdit()}
        >
          {t('graph.save_edit', '保存修改')}
        </Button>
        <Button
          type="button"
          disabled={props.busy}
          onClick={() => void props.onDeleteSelectedNode()}
        >
          {t('graph.delete_node', '删除节点')}
        </Button>
        {selectedNode.nodeType !== 'entry' ? (
          <Button type="button" disabled={props.busy} onClick={props.onOpenSplit}>
            {t('graph.split_node', '拆分')}
          </Button>
        ) : null}
        {selectedNode.discriminator ? (
          <Button
            type="button"
            disabled={props.busy}
            onClick={() => void props.onRevertSplit(String(selectedNode.discriminator))}
          >
            {t('graph.revert_split', '撤回拆分')}
          </Button>
        ) : null}
      </div>
      {selectedNode.reviewStatus === 'pending' ? (
        <div className={styles.rowActions}>
          <Button
            type="button"
            onClick={() => void props.onReviewNode(selectedNode.id, 'approved')}
          >
            {t('graph.approve', '通过')}
          </Button>
          <Button
            type="button"
            onClick={() => void props.onReviewNode(selectedNode.id, 'rejected')}
          >
            {t('graph.reject', '拒绝')}
          </Button>
        </div>
      ) : null}

      <div className={styles.detailBlock} style={{ marginTop: 16 }}>
        <div className={styles.detailLabel}>{t('graph.add_edge', '添加关系')}</div>
        <Input
          fieldSize="small"
          value={props.addEdgeQuery}
          onChange={(e) => props.onAddEdgeQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void props.onSearchAddEdgeTarget()
          }}
          placeholder={t('graph.add_edge_search', '搜索目标节点')}
        />
        <div className={styles.rowActions}>
          <Button type="button" onClick={() => void props.onSearchAddEdgeTarget()}>
            {t('graph.search', '搜索')}
          </Button>
          <div className={styles.editSelect}>
            <Select
              size="small"
              value={props.addEdgeType}
              aria-label={t('graph.add_edge', '添加关系')}
              onChange={(e) => props.onAddEdgeTypeChange(e.target.value)}
              options={(props.edgeTypes.length ? props.edgeTypes : ['relates_to']).map((et) => ({
                value: et,
                label: translateGraphEdgeType(tr, et)
              }))}
            />
          </div>
          <Button
            type="button"
            disabled={props.busy || !props.addEdgeToId}
            onClick={() => void props.onAddEdge()}
          >
            {t('graph.add_edge_submit', '添加')}
          </Button>
        </div>
        {props.addEdgeHits.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`${styles.hitBtn} ${props.addEdgeToId === h.id ? styles.hitBtnActive : ''}`}
            onClick={() => props.onAddEdgeToIdChange(h.id)}
          >
            {h.name} · {translateGraphNodeType(tr, h.nodeType)}
          </button>
        ))}
      </div>

      <div className={styles.detailBlock}>
        <div className={styles.detailLabel}>{t('graph.local_relations', '直接关系')}</div>
        <div className={styles.detailValue}>
          {t('graph.direct_edge_stats', '{{edgeCount}} 条与该节点相连的边', {
            edgeCount: props.detailEdges.length
          })}
        </div>
      </div>
      {props.detailEdges.length === 0 ? (
        <div className={styles.empty}>
          {t('graph.no_direct_edges', '暂无与该节点直接相连的关系')}
        </div>
      ) : (
        props.detailEdges.map(({ edge: e, partnerName }) => (
          <div key={e.id} className={styles.item}>
            <div className={styles.relationPartner}>{partnerName}</div>
            <div className={styles.itemMeta}>
              {translateGraphEdgeType(tr, e.edgeType)}
              {e.reviewStatus === 'pending' ? ` · ${t('graph.pending_badge', '待确认')}` : ''}
              {e.sourceExcerpt ? ` · ${e.sourceExcerpt}` : ''}
            </div>
            <div className={styles.rowActions}>
              {e.sourceRef || e.sourceExcerpt ? (
                <Button
                  type="button"
                  onClick={() => void props.onOpenSource(e.sourceRef, e.sourceExcerpt)}
                >
                  {t('graph.open_source', '打开原文')}
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={props.busy}
                onClick={() => void props.onDeleteEdge(e.id)}
              >
                {t('graph.delete_edge', '删除')}
              </Button>
            </div>
          </div>
        ))
      )}
    </>
  )
}
