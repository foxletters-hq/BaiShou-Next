import React from 'react'
import { useTranslation } from 'react-i18next'
import { SUMMARY_PROMPT_LOCALE_OPTIONS } from '@baishou/shared'
import { HelpTooltip } from '../HelpTooltip'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Button } from '../Button/Button'
import styles from './SummarySettingsView.module.css'
import stack from '../shared/SettingsStack.module.css'
import type { SummarySettingsViewModel } from './useSummarySettingsView'

export function SummaryTemplateSection({ vm }: { vm: SummarySettingsViewModel }) {
  const { t } = useTranslation()
  const { config } = vm

  return (
    <>
      <div className={stack.stackGroup}>
        <div className={stack.sectionLabelRow}>
          <h3 className={stack.sectionLabel}>
            {t('settings.summary_data_sources_title', 'What each summary reads')}
          </h3>
          <HelpTooltip
            size={14}
            content={t(
              'settings.summary_data_sources_desc',
              'When generating each type of summary, BaiShou reads the following sources for that period.'
            )}
          />
        </div>
        <section className={stack.cardSection}>
          <div className={styles.sectionBody}>
            <ul className={styles.dataSourceList}>
              <li>
                {t('settings.summary_data_source_weekly', 'Weekly: diaries within that week')}
              </li>
              <li>
                {t(
                  'settings.summary_data_source_monthly',
                  'Monthly: always reads this month’s weeklies; the switch below adds this month’s diaries'
                )}
              </li>
              <li>
                {t(
                  'settings.summary_data_source_quarterly',
                  'Quarterly: monthly summaries in that quarter'
                )}
              </li>
              <li>
                {t(
                  'settings.summary_data_source_yearly',
                  'Yearly: quarterly summaries in that year'
                )}
              </li>
            </ul>
          </div>
          <div className={stack.divider} />
          <div className={styles.sectionBody}>
            <div className={styles.subsectionTitleRow}>
              <div className={styles.subsectionTitle}>
                {t('settings.monthly_summary_data_source', 'Monthly summary data source')}
              </div>
              <HelpTooltip
                size={14}
                content={t(
                  'settings.monthly_summary_data_source_desc',
                  'Both options read this month’s weeklies; optionally also include this month’s diaries for more detail'
                )}
              />
            </div>
            <SegmentedControl
              value={config.monthlySummarySource}
              options={[
                {
                  value: 'weeklies',
                  label: t('settings.read_only_weeklies', 'Weeklies only')
                },
                {
                  value: 'diaries',
                  label: t('settings.read_all_diaries', 'Weeklies + diaries')
                }
              ]}
              onChange={(monthlySummarySource) => vm.emitSettings({ monthlySummarySource })}
            />
          </div>
        </section>
      </div>

      <div className={stack.stackGroup}>
        <div className={stack.sectionLabelRow}>
          <h3 className={stack.sectionLabel}>
            {t('settings.summary_generation_templates_title', 'Summary generation templates')}
          </h3>
          <HelpTooltip
            size={14}
            content={t(
              'settings.summary_generation_templates_desc',
              'User-side templates for weekly, monthly, quarterly and yearly summaries. Customize per language below.'
            )}
          />
        </div>
        <section className={stack.cardSection}>
          <div className={styles.sectionBody}>
            <div className={styles.langBar}>
              {SUMMARY_PROMPT_LOCALE_OPTIONS.map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  className={`${styles.langChip} ${vm.activePromptLocale === lang.id ? styles.langChipActive : ''} ${config.promptLocale === lang.id ? styles.langChipGeneration : ''}`}
                  onClick={() => vm.handlePromptLocaleChange(lang.id)}
                >
                  {t(lang.labelKey, lang.fallback)}
                </button>
              ))}
            </div>
            <p className={styles.localeHint}>
              {t('settings.summary_prompt_editing_locale', '正在编辑模板语言')}:{' '}
              <strong>{vm.activeLocaleLabel}</strong>
            </p>
            <p className={styles.localeHintMeta}>
              {t(
                'settings.summary_prompt_generation_locale',
                '自动生成总结时使用「常规设置」所选语言的模板。'
              )}
            </p>

            <SegmentedControl
              stretch
              spaced
              value={vm.activeTab}
              options={vm.tabs.map((tab) => ({
                value: tab.id,
                label: tab.label
              }))}
              onChange={vm.handleTabChange}
            />

            <div className={styles.textAreaWrapper}>
              <textarea
                className={styles.systemPromptArea}
                value={vm.localText}
                onChange={(e) => vm.setLocalText(e.target.value)}
                rows={8}
                placeholder={t(
                  'settings.summary_ai_prompt_hint',
                  'Write guidelines for AI when extracting and generating summaries...'
                )}
              />
              <div className={styles.actionsRow}>
                <Button type="button" variant="outlined" size="small" onClick={vm.handleReset}>
                  {t('settings.restore_default', 'Restore default')}
                </Button>
                <Button type="button" variant="outlined" size="small" onClick={vm.handleSave}>
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
