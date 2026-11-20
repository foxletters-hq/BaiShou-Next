import React from 'react'
import { useTranslation } from 'react-i18next'
import type { DeepSeekSessionPreview } from '@baishou/shared'
import { Button, Checkbox } from '@baishou/ui'
import pane from './GeneralSettingsPane.module.css'
import styles from './DeepSeekImportPane.module.css'

export interface DeepSeekImportSessionListSectionProps {
  sessions: DeepSeekSessionPreview[]
  selectedSessionIds: Set<string>
  onToggleSession: (sourceId: string) => void
  onToggleSelectAll: () => void
  onStartImport: () => void
  canStartImport: boolean
  importing?: boolean
  disabled?: boolean
}

function formatShortDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const DeepSeekImportSessionListSection: React.FC<DeepSeekImportSessionListSectionProps> = ({
  sessions,
  selectedSessionIds,
  onToggleSession,
  onToggleSelectAll,
  onStartImport,
  canStartImport,
  importing = false,
  disabled = false
}) => {
  const { t } = useTranslation()

  const selectedCount = selectedSessionIds.size
  const allSelected = sessions.length > 0 && selectedCount === sessions.length
  const isIndeterminate = selectedCount > 0 && selectedCount < sessions.length

  return (
    <div className={pane.stackGroup}>
      <div className={pane.sectionLabelRow}>
        <h3 className={pane.sectionLabel}>{t('deepseek_import.sessions_section_title')}</h3>
      </div>

      <section className={pane.cardSection}>
        <div className={styles.sessionHeader}>
          <div className={styles.sessionHeaderMeta}>
            <span className={styles.sessionCount}>
              {t('deepseek_import.selected_count', {
                selected: selectedCount,
                total: sessions.length
              })}
            </span>
          </div>

          <div className={styles.sessionActionBar}>
            <label className={styles.selectAllLabel}>
              <Checkbox
                checked={allSelected}
                indeterminate={isIndeterminate}
                disabled={disabled}
                onChange={onToggleSelectAll}
              />
              <span>
                {allSelected ? t('deepseek_import.deselect_all') : t('deepseek_import.select_all')}
              </span>
            </label>

            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={onStartImport}
              disabled={!canStartImport}
              isLoading={importing}
            >
              {t('deepseek_import.start_import_button', { count: selectedCount })}
            </Button>
          </div>
        </div>

        <div className={styles.sessionList}>
          {sessions.map((session) => {
            const checked = selectedSessionIds.has(session.sourceId)
            return (
              <label key={session.sourceId} className={styles.sessionRow}>
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggleSession(session.sourceId)}
                />
                <div className={styles.sessionBody}>
                  <span className={styles.sessionTitle}>
                    {session.title || t('deepseek_import.untitled_session')}
                  </span>
                  <div className={styles.sessionMetaRow}>
                    <span>
                      {t('deepseek_import.session_messages_count', { count: session.messageCount })}
                    </span>
                    <span>·</span>
                    <span>{formatShortDate(session.updatedAt)}</span>
                    {session.hasThinking ? (
                      <span className={styles.tagChip}>{t('deepseek_import.tag_thinking')}</span>
                    ) : null}
                    {session.hasSearch ? (
                      <span className={styles.tagChip}>{t('deepseek_import.tag_search')}</span>
                    ) : null}
                    {session.imageCount > 0 ? (
                      <span className={styles.tagChip}>
                        {t('deepseek_import.tag_images', { count: session.imageCount })}
                      </span>
                    ) : null}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </section>
    </div>
  )
}
