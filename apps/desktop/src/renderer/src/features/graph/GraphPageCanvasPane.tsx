import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_NODE_TYPE_LABEL_FALLBACKS,
  graphNodeTypeColor,
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings
} from '@baishou/shared'
import { Checkbox } from '@baishou/ui'
import { GraphCanvasSettingsPanel } from './GraphCanvasSettingsPanel'
import { GRAPH_FILTER_NODE_TYPES } from './graph-page-display.util'
import styles from './GraphPage.module.css'

export function GraphPageCanvasPane(props: {
  filterActive: boolean
  typeFilterActive: boolean
  hideEntry: boolean
  approvedOnly: boolean
  enabledNodeTypes: Set<string>
  onHideEntryChange: (checked: boolean) => void
  onApprovedOnlyChange: (checked: boolean) => void
  onResetFilters: () => void
  onToggleTypeFilter: (nodeType: string) => void
  onToggleAllTypes: () => void
  focusDepth: GraphFocusDepth
  appearanceSettings: GraphAppearanceSettings
  forceSettings: GraphForceSettings
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  onForceChange: (patch: Partial<GraphForceSettings>) => void
  onReplayLayout: () => void
  onResetGraphSettings: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <>
      <div className={styles.settingsHeader}>
        <div className={styles.settingsTitle}>{t('graph.side_canvas', '画布')}</div>
        <button
          type="button"
          className={styles.settingsReset}
          title={t('graph.force_reset', '恢复默认')}
          onClick={props.onResetGraphSettings}
        >
          {t('graph.force_reset', '恢复默认')}
        </button>
      </div>
      <div className={styles.panel} data-graph-side-scroll>
        <div className={styles.opsBlock}>
          <div className={styles.filterSectionHead}>
            <span className={styles.viewFieldLabel}>{t('graph.filter', '筛选')}</span>
            {props.filterActive ? (
              <button
                type="button"
                className={styles.filterSectionAction}
                onClick={props.onResetFilters}
              >
                {t('graph.filter_reset', '恢复默认')}
              </button>
            ) : null}
          </div>
          <label className={styles.checkLabel}>
            <Checkbox
              checked={props.hideEntry}
              onChange={(e) => props.onHideEntryChange(e.target.checked)}
            />
            {t('graph.hide_entry_anchors', '隐藏日记锚点')}
          </label>
          <label className={styles.checkLabel}>
            <Checkbox
              checked={props.approvedOnly}
              onChange={(e) => props.onApprovedOnlyChange(e.target.checked)}
            />
            {t('graph.approved_only', '只看已确认')}
          </label>
          <div className={styles.filterSection}>
            <div className={styles.filterSectionHead}>
              <span className={styles.filterSectionTitle}>
                {t('graph.filter_by_type', '按分类')}
              </span>
              <button
                type="button"
                className={styles.filterSectionAction}
                onClick={props.onToggleAllTypes}
              >
                {props.typeFilterActive
                  ? t('graph.filter_select_all_types', '全选')
                  : t('graph.filter_clear_types', '清空')}
              </button>
            </div>
            <div className={styles.typeChipRow}>
              {GRAPH_FILTER_NODE_TYPES.map((nodeType) => {
                const active = props.enabledNodeTypes.has(nodeType)
                const typeColor = graphNodeTypeColor(nodeType)
                return (
                  <button
                    key={nodeType}
                    type="button"
                    className={active ? styles.typeChipActive : styles.typeChip}
                    style={
                      active
                        ? ({
                            '--type-chip-color': typeColor
                          } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => props.onToggleTypeFilter(nodeType)}
                  >
                    {t(
                      `graph.node_type.${nodeType}`,
                      GRAPH_NODE_TYPE_LABEL_FALLBACKS[nodeType] ?? nodeType
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <GraphCanvasSettingsPanel
          focusDepth={props.focusDepth}
          appearanceSettings={props.appearanceSettings}
          forceSettings={props.forceSettings}
          onFocusDepthChange={props.onFocusDepthChange}
          onAppearanceChange={props.onAppearanceChange}
          onForceChange={props.onForceChange}
          onReplayLayout={props.onReplayLayout}
        />
      </div>
    </>
  )
}
