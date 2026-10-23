import React from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { SHARED_MEMORY_LOOKBACK_MIN } from '@baishou/shared'
import { formatCompactTokenCount } from '../../shared/token-usage-display'
import { HelpTooltip } from '../HelpTooltip'
import { Input } from '../Input/Input'
import { Switch } from '../Switch/Switch'
import styles from './SummarySettingsView.module.css'
import stack from '../shared/SettingsStack.module.css'
import { buildSharedMemoryPreviewChips } from '../../shared/shared-memory-preview.util'
import type { SummarySettingsViewModel } from './useSummarySettingsView'
import '../DashboardSharedMemoryCard/DashboardSharedMemoryCard.css'

export function SummaryInjectSection({ vm }: { vm: SummarySettingsViewModel }) {
  const { t } = useTranslation()
  const chips = vm.injectPreview
    ? buildSharedMemoryPreviewChips(vm.injectPreview, (key, fallback) => t(key, fallback))
    : []

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>
          {t('settings.summary_inject_shared_memory', 'Inject shared memory before generation')}
        </h3>
        <HelpTooltip
          size={14}
          content={t(
            'settings.summary_inject_shared_memory_desc',
            'When on, shared memory from the months before this period is inserted between the template and this period’s raw data for continuity.'
          )}
        />
      </div>
      <section className={stack.cardSection}>
        <div className={styles.injectToggleRow}>
          <span className={styles.injectToggleLabel}>
            {t('settings.summary_inject_enabled', '开启注入')}
          </span>
          <Switch
            size="sm"
            checked={vm.injectEnabled}
            onChange={(e) =>
              vm.emitSettings({
                injectSharedMemoryBeforeGenerate: e.target.checked
              })
            }
            aria-label={t('settings.summary_inject_enabled', '开启注入')}
          />
        </div>

        {vm.injectEnabled && (
          <>
            <div className={styles.injectDivider} />
            <div className={styles.injectBody}>
              <div className="sm-controls" style={{ marginBottom: 0 }}>
                <div className="sm-label-row">
                  <label className={styles.injectLookbackLabel} htmlFor="summary-inject-lookback">
                    {t('settings.summary_inject_lookback_label', '回溯月数')}
                  </label>
                  <Input
                    id="summary-inject-lookback"
                    type="number"
                    fieldSize="small"
                    className="sm-number-input-host"
                    min={SHARED_MEMORY_LOOKBACK_MIN}
                    value={vm.lookbackDraft}
                    onChange={(e) => vm.previewLookback(Number(e.target.value))}
                    onBlur={() => vm.commitLookback()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur()
                      }
                    }}
                  />
                </div>
                <div className="sm-slider-container">
                  <input
                    type="range"
                    min={SHARED_MEMORY_LOOKBACK_MIN}
                    max={vm.sliderMax}
                    step={1}
                    value={Math.min(vm.lookbackDraft, vm.sliderMax)}
                    onChange={(e) => {
                      vm.lookbackDraggingRef.current = true
                      vm.previewLookback(Number(e.target.value))
                    }}
                    onPointerUp={() => vm.commitLookback()}
                    onMouseUp={() => vm.commitLookback()}
                    onTouchEnd={() => vm.commitLookback()}
                    onKeyUp={(e) => {
                      if (
                        e.key === 'ArrowLeft' ||
                        e.key === 'ArrowRight' ||
                        e.key === 'Home' ||
                        e.key === 'End' ||
                        e.key === 'PageUp' ||
                        e.key === 'PageDown'
                      ) {
                        vm.commitLookback()
                      }
                    }}
                    className="sm-slider"
                    style={{ backgroundSize: `${vm.sliderPct}% 100%` }}
                    aria-label={t('settings.summary_inject_lookback_label', '回溯月数')}
                  />
                </div>
              </div>

              {vm.injectPreviewLoading && !vm.injectPreview ? (
                <div className="sm-preview sm-previewLoading">
                  <Loader2 size={14} className="sm-previewSpinner" />
                  <span>
                    {t('settings.summary_inject_preview_loading', '正在统计预计发送内容…')}
                  </span>
                </div>
              ) : vm.injectPreview ? (
                <div className="sm-preview" style={{ marginBottom: 0 }}>
                  <div className="sm-previewTitle">
                    {t('settings.summary_inject_preview_title', '预计发送内容')}
                    {vm.injectPreviewLoading ? (
                      <Loader2 size={12} className="sm-previewSpinnerInline" />
                    ) : null}
                  </div>
                  {vm.injectPreview.total === 0 ? (
                    <p className="sm-previewEmpty">
                      {t('summary.copy_preview_empty', '当前回溯范围内暂无可复制内容')}
                    </p>
                  ) : (
                    <>
                      <div className="sm-previewChips">
                        {chips.map((item) => (
                          <span key={item.key} className="sm-previewChip">
                            {item.label} {item.count}
                            {t('summary.copy_preview_unit', '篇')}
                          </span>
                        ))}
                      </div>
                      <p className="sm-previewTotal">
                        {t('summary.copy_preview_total', '共 {{count}} 项', {
                          count: vm.injectPreview.total
                        })}
                      </p>
                      <p className="sm-previewSize">
                        {t(
                          'summary.copy_preview_estimated_size',
                          '约 {{chars}} 字 · 约 {{tokens}} tokens',
                          {
                            chars: vm.injectPreview.estimatedChars.toLocaleString(),
                            tokens: formatCompactTokenCount(vm.injectPreview.estimatedTokens)
                          }
                        )}
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
