import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_APPEARANCE_RANGES,
  GRAPH_FOCUS_DEPTH_OPTIONS,
  GRAPH_FORCE_RANGES,
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings
} from '@baishou/shared'
import { Checkbox } from '@baishou/ui'
import styles from './GraphPage.module.css'

export type GraphCanvasSettingsSection = 'view' | 'appearance' | 'forces'

export interface GraphCanvasSettingsPanelProps {
  focusDepth: GraphFocusDepth
  appearanceSettings: GraphAppearanceSettings
  forceSettings: GraphForceSettings
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  onForceChange: (patch: Partial<GraphForceSettings>) => void
  onReplayLayout: () => void
}

export const GraphCanvasSettingsPanel: React.FC<GraphCanvasSettingsPanelProps> = ({
  focusDepth,
  appearanceSettings,
  forceSettings,
  onFocusDepthChange,
  onAppearanceChange,
  onForceChange,
  onReplayLayout
}) => {
  const { t } = useTranslation()
  const [sectionOpen, setSectionOpen] = useState<Record<GraphCanvasSettingsSection, boolean>>({
    view: true,
    appearance: true,
    forces: true
  })

  const toggle = (key: GraphCanvasSettingsSection) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
      <div className={styles.settingsSection}>
        <button
          type="button"
          className={styles.settingsSectionHead}
          onClick={() => toggle('view')}
        >
          <span className={styles.settingsChevron}>{sectionOpen.view ? '▾' : '▸'}</span>
          {t('graph.view_section', '浏览')}
        </button>
        {sectionOpen.view ? (
          <div className={styles.settingsSectionBody}>
            <div className={styles.viewField}>
              <div className={styles.viewFieldLabel}>{t('graph.focus_depth', '展开等级')}</div>
              <p className={styles.viewFieldHint}>
                {t(
                  'graph.focus_depth_hint',
                  '选中节点后，高亮其周围几级关系（1=直接相连，2=再扩一层）'
                )}
              </p>
              <div
                className={styles.depthSeg}
                role="radiogroup"
                aria-label={t('graph.focus_depth', '展开')}
              >
                {GRAPH_FOCUS_DEPTH_OPTIONS.map((depth) => {
                  const active = focusDepth === depth
                  return (
                    <button
                      key={depth}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`${styles.depthBtn} ${active ? styles.depthBtnActive : ''}`}
                      onClick={() => onFocusDepthChange(depth)}
                    >
                      {depth}
                      {t('graph.focus_depth_unit', '级')}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.settingsSection}>
        <button
          type="button"
          className={styles.settingsSectionHead}
          onClick={() => toggle('appearance')}
        >
          <span className={styles.settingsChevron}>{sectionOpen.appearance ? '▾' : '▸'}</span>
          {t('graph.appearance', '外观')}
        </button>
        {sectionOpen.appearance ? (
          <div className={styles.settingsSectionBody}>
            <label className={styles.settingsToggleRow}>
              <span>{t('graph.show_arrows', '箭头')}</span>
              <Checkbox
                checked={appearanceSettings.showArrows}
                onChange={(event) => onAppearanceChange({ showArrows: event.target.checked })}
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.text_opacity', '文本透明度')}
              </span>
              <span className={styles.forceValue}>{appearanceSettings.textOpacity.toFixed(2)}</span>
              <input
                type="range"
                min={GRAPH_APPEARANCE_RANGES.textOpacity.min}
                max={GRAPH_APPEARANCE_RANGES.textOpacity.max}
                step={GRAPH_APPEARANCE_RANGES.textOpacity.step}
                value={appearanceSettings.textOpacity}
                onChange={(event) =>
                  onAppearanceChange({ textOpacity: Number(event.target.value) })
                }
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>{t('graph.node_size', '节点大小')}</span>
              <span className={styles.forceValue}>{appearanceSettings.nodeSize.toFixed(2)}</span>
              <input
                type="range"
                min={GRAPH_APPEARANCE_RANGES.nodeSize.min}
                max={GRAPH_APPEARANCE_RANGES.nodeSize.max}
                step={GRAPH_APPEARANCE_RANGES.nodeSize.step}
                value={appearanceSettings.nodeSize}
                onChange={(event) => onAppearanceChange({ nodeSize: Number(event.target.value) })}
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.line_thickness', '连线粗细')}
              </span>
              <span className={styles.forceValue}>
                {appearanceSettings.lineThickness.toFixed(2)}
              </span>
              <input
                type="range"
                min={GRAPH_APPEARANCE_RANGES.lineThickness.min}
                max={GRAPH_APPEARANCE_RANGES.lineThickness.max}
                step={GRAPH_APPEARANCE_RANGES.lineThickness.step}
                value={appearanceSettings.lineThickness}
                onChange={(event) =>
                  onAppearanceChange({ lineThickness: Number(event.target.value) })
                }
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.hub_label_degree', '显名边数')}
              </span>
              <span className={styles.forceValue}>{appearanceSettings.hubLabelMinDegree}</span>
              <input
                type="range"
                min={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.min}
                max={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.max}
                step={GRAPH_APPEARANCE_RANGES.hubLabelMinDegree.step}
                value={appearanceSettings.hubLabelMinDegree}
                onChange={(event) =>
                  onAppearanceChange({ hubLabelMinDegree: Number(event.target.value) })
                }
                title={t(
                  'graph.hub_label_degree_hint',
                  '连接边达到该数量时，全局视图默认显示名称'
                )}
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.hub_label_mentions', '显名提及')}
              </span>
              <span className={styles.forceValue}>{appearanceSettings.hubLabelMinMentions}</span>
              <input
                type="range"
                min={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.min}
                max={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.max}
                step={GRAPH_APPEARANCE_RANGES.hubLabelMinMentions.step}
                value={appearanceSettings.hubLabelMinMentions}
                onChange={(event) =>
                  onAppearanceChange({ hubLabelMinMentions: Number(event.target.value) })
                }
                title={t(
                  'graph.hub_label_mentions_hint',
                  '提及次数达到该值时，全局视图默认显示名称'
                )}
              />
            </label>
            <button
              type="button"
              className={styles.btn}
              onClick={onReplayLayout}
              title={t('graph.replay_layout_hint', '给节点一点扰动，重新跑一遍力导向布局')}
            >
              {t('graph.replay_layout', '重新布局')}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.settingsSection}>
        <button
          type="button"
          className={styles.settingsSectionHead}
          onClick={() => toggle('forces')}
        >
          <span className={styles.settingsChevron}>{sectionOpen.forces ? '▾' : '▸'}</span>
          {t('graph.forces', '力度')}
        </button>
        {sectionOpen.forces ? (
          <div className={styles.settingsSectionBody}>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.force_center', '图谱向心力')}
              </span>
              <span className={styles.forceValue}>{forceSettings.centerStrength.toFixed(2)}</span>
              <input
                type="range"
                min={GRAPH_FORCE_RANGES.centerStrength.min}
                max={GRAPH_FORCE_RANGES.centerStrength.max}
                step={GRAPH_FORCE_RANGES.centerStrength.step}
                value={forceSettings.centerStrength}
                onChange={(event) =>
                  onForceChange({ centerStrength: Number(event.target.value) })
                }
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.force_charge', '节点排斥力')}
              </span>
              <span className={styles.forceValue}>{Math.abs(forceSettings.chargeStrength)}</span>
              <input
                type="range"
                min={GRAPH_FORCE_RANGES.chargeStrength.min}
                max={GRAPH_FORCE_RANGES.chargeStrength.max}
                step={GRAPH_FORCE_RANGES.chargeStrength.step}
                value={forceSettings.chargeStrength}
                onChange={(event) =>
                  onForceChange({ chargeStrength: Number(event.target.value) })
                }
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.force_link', '相连吸引力')}
              </span>
              <span className={styles.forceValue}>{forceSettings.linkStrength.toFixed(2)}</span>
              <input
                type="range"
                min={GRAPH_FORCE_RANGES.linkStrength.min}
                max={GRAPH_FORCE_RANGES.linkStrength.max}
                step={GRAPH_FORCE_RANGES.linkStrength.step}
                value={forceSettings.linkStrength}
                onChange={(event) => onForceChange({ linkStrength: Number(event.target.value) })}
              />
            </label>
            <label className={styles.settingsSliderRow}>
              <span className={styles.settingsSliderLabel}>
                {t('graph.force_link_distance', '连线长度')}
              </span>
              <span className={styles.forceValue}>{forceSettings.linkDistance}</span>
              <input
                type="range"
                min={GRAPH_FORCE_RANGES.linkDistance.min}
                max={GRAPH_FORCE_RANGES.linkDistance.max}
                step={GRAPH_FORCE_RANGES.linkDistance.step}
                value={forceSettings.linkDistance}
                onChange={(event) =>
                  onForceChange({ linkDistance: Number(event.target.value) })
                }
              />
            </label>
          </div>
        ) : null}
      </div>
    </>
  )
}
