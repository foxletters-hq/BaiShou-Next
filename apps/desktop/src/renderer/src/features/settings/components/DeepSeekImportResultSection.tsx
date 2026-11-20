import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import type { DeepSeekImportResult } from '@baishou/shared'
import { Button } from '@baishou/ui'
import pane from './GeneralSettingsPane.module.css'
import styles from './DeepSeekImportPane.module.css'

export interface DeepSeekImportResultSectionProps {
  result: DeepSeekImportResult
  onOpenAssistant: () => void
  onImportAnother: () => void
}

export const DeepSeekImportResultSection: React.FC<DeepSeekImportResultSectionProps> = ({
  result,
  onOpenAssistant,
  onImportAnother
}) => {
  const { t } = useTranslation()

  return (
    <div className={pane.stackGroup}>
      <section className={pane.cardSection}>
        <div className={styles.cardBody}>
          <div className={styles.resultHeader}>
            <CheckCircle2 size={24} className={styles.resultIcon} />
            <div className={styles.heroTextCol}>
              <h4 className={styles.heroTitle}>{t('deepseek_import.result_title')}</h4>
              <p className={styles.heroDesc}>
                {result.createdNewAssistant
                  ? t('deepseek_import.result_target_new', { name: result.assistantName })
                  : t('deepseek_import.result_target_existing', { name: result.assistantName })}
              </p>
            </div>
          </div>

          <div className={styles.resultStatsGrid}>
            <div className={styles.statCell}>
              <span className={styles.statValue}>{result.importedSessions}</span>
              <span className={styles.statLabel}>{t('deepseek_import.result_stat_imported')}</span>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statValue}>{result.importedMessages}</span>
              <span className={styles.statLabel}>{t('deepseek_import.result_stat_messages')}</span>
            </div>
            <div className={styles.statCell}>
              <span className={`${styles.statValue} ${styles.statValueMuted}`}>
                {result.skippedSessions}
              </span>
              <span className={styles.statLabel}>{t('deepseek_import.result_stat_skipped')}</span>
            </div>
            <div className={styles.statCell}>
              <span
                className={`${styles.statValue} ${
                  result.failedSessions > 0 ? styles.statValueError : styles.statValueMuted
                }`}
              >
                {result.failedSessions}
              </span>
              <span className={styles.statLabel}>{t('deepseek_import.result_stat_failed')}</span>
            </div>
          </div>

          {result.importedAttachments > 0 ? (
            <p className={styles.metaLine}>
              {t('deepseek_import.result_attachments_note', { count: result.importedAttachments })}
            </p>
          ) : null}

          {result.failureSamples.length > 0 ? (
            <div className={styles.failureBox}>
              <p className={styles.failureTitle}>{t('deepseek_import.result_failures_title')}</p>
              {result.failureSamples.map((sample, idx) => (
                <p key={idx} className={styles.failureItem}>
                  • {sample}
                </p>
              ))}
            </div>
          ) : null}

          <div className={styles.resultActions}>
            <Button type="button" variant="outlined" size="small" onClick={onImportAnother}>
              {t('deepseek_import.import_another_button')}
            </Button>
            <Button type="button" variant="outlined" size="small" onClick={onOpenAssistant}>
              {t('deepseek_import.open_assistant_button')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
