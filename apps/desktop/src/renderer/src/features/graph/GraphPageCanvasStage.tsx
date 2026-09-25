import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatGraphMonth, parseGraphMonthToDate, type GraphMonthRange } from '@baishou/shared'
import { Button } from '@baishou/ui'
import { GraphForceCanvas } from './GraphForceCanvas'
import styles from './GraphPage.module.css'

export function GraphPageCanvasStage(props: {
  paused?: boolean
  showEmptyGuide: boolean
  showMonthEmpty: boolean
  organizePendingCount: number
  highlightStartOrganize: boolean
  onStartOrganize: () => void
  onDismissGuide: () => void
  displayNodes: any[]
  displayEdges: any[]
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
  locateIds: string[] | null
  focusIds: Set<string> | undefined
  selectedId: string | null
  locateSeq: number
  forceSettings: React.ComponentProps<typeof GraphForceCanvas>['forceSettings']
  appearanceSettings: React.ComponentProps<typeof GraphForceCanvas>['appearanceSettings']
  animationTick: number
  onSelectNode: (id: string) => void
  onClearSelection: () => void
  monthRange: GraphMonthRange
  onResetMonthRange: () => void
  onExtendMonthRangeEarlier: (startMonth: string) => void
  focusDepth: number
}): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className={styles.canvasWrap}>
      {props.showEmptyGuide ? (
        <div className={styles.emptyGuide}>
          <div className={styles.emptyGuideTitle}>
            {t('graph.empty_guide_title', '还没有开始整理你的人生关系图')}
          </div>
          <div className={styles.emptyGuideBody}>
            {t(
              'graph.empty_guide_body',
              '有 {{count}} 篇还没整理。点「开始整理记忆」会补齐向量并整理关系图谱。',
              {
                count: props.organizePendingCount
              }
            )}
          </div>
          <div className={styles.rowActions}>
            <Button
              type="button"
              className={props.highlightStartOrganize ? styles.highlightStartOrganize : ''}
              onClick={props.onStartOrganize}
            >
              {t('memory.start_organize', '开始整理记忆')}
            </Button>
            <Button type="button" onClick={props.onDismissGuide}>
              {t('graph.later', '以后再说')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <GraphForceCanvas
            paused={props.paused}
            nodes={props.displayNodes}
            edges={props.displayEdges}
            highlightIds={props.highlightIds}
            highlightEdgeIds={props.highlightedEdgeIds}
            locateIds={props.locateIds ?? undefined}
            focusIds={props.focusIds}
            selectedId={props.selectedId}
            locateSeq={props.locateSeq}
            forceSettings={props.forceSettings}
            appearanceSettings={props.appearanceSettings}
            animationTick={props.animationTick}
            onSelectNode={(id) => {
              void props.onSelectNode(id)
            }}
            onClearSelection={props.onClearSelection}
          />
          {props.showMonthEmpty ? (
            <div className={styles.monthEmpty}>
              <div className={styles.monthEmptyTitle}>
                {t('graph.month_empty_title', '这个月份范围内还没有关系')}
              </div>
              <div className={styles.monthEmptyBody}>
                {t(
                  'graph.month_empty_body',
                  '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
                  {
                    start: props.monthRange.startMonth,
                    end: props.monthRange.endMonth
                  }
                )}
              </div>
              <div className={styles.rowActions}>
                <Button type="button" onClick={props.onResetMonthRange}>
                  {t('graph.month_range_recent3', '近3月')}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    const start = parseGraphMonthToDate(props.monthRange.startMonth)
                    start.setMonth(start.getMonth() - 12)
                    props.onExtendMonthRangeEarlier(formatGraphMonth(start))
                  }}
                >
                  {t('graph.month_range_earlier', '再往前一年')}
                </Button>
              </div>
            </div>
          ) : null}
          <div className={styles.legend}>
            {props.highlightedEdgeIds.size > 0
              ? t(
                  'graph.legend_pending_edge',
                  '已定位这条关系：两端节点和中间连线已高亮；单击空白取消。'
                )
              : props.selectedId
                ? t(
                    'graph.legend_focus_depth',
                    '已选中：高亮 {{depth}} 级关系（共 {{count}} 个节点）；单击空白取消。',
                    {
                      depth: props.focusDepth,
                      count: props.focusIds?.size ?? 1
                    }
                  )
                : t('graph.legend_month', '默认显示近 3 个月的关系；可在顶部栏调整月份范围。')}
          </div>
        </>
      )}
    </div>
  )
}
