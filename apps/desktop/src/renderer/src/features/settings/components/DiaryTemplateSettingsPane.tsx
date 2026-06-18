import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE
} from '@baishou/shared'
import { useToast } from '@baishou/ui'
import { useDiaryTemplateConfig } from '../hooks/useDiaryTemplateConfig'
import styles from './DiarySettingsPane.module.css'

export const DiaryTemplateSettingsPane: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { config, hydrated, saving, persistMerge } = useDiaryTemplateConfig()

  const [localNewEntry, setLocalNewEntry] = useState('')
  const [localAppendBlock, setLocalAppendBlock] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!hydrated || dirty) return
    setLocalNewEntry(config.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
    setLocalAppendBlock(config.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
  }, [hydrated, config.newEntryTemplate, config.appendBlockTemplate, dirty])

  const handleSave = async () => {
    try {
      const next = await persistMerge({
        newEntryTemplate: localNewEntry.trim(),
        appendBlockTemplate: localAppendBlock.trim()
      })
      setLocalNewEntry(next.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(next.appendBlockTemplate?.trim() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setDirty(false)
      toast.showSuccess(t('settings.saved', '已保存'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const handleReset = async () => {
    try {
      await persistMerge({
        newEntryTemplate: undefined,
        appendBlockTemplate: undefined
      })
      setLocalNewEntry(DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setDirty(false)
      toast.showSuccess(t('summary.reset_template_success', '已恢复默认模板'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const canSave = hydrated && dirty && !saving

  return (
    <div className={`settings-pane settings-content-scroll ${styles.container}`}>
      <section className={styles.card}>
        <h3 className={styles.cardTitle}>
          {t('settings.diary_template_new_entry', '新建日记模板')}
        </h3>
        <p className={styles.desc}>
          {t(
            'settings.diary_template_new_entry_desc',
            '创建新日记时自动填入的正文开头，可用变量见下方说明。'
          )}
        </p>
        {!hydrated ? (
          <div className={styles.loadingRow}>{t('common.loading', '加载中…')}</div>
        ) : (
          <textarea
            className={styles.textarea}
            value={localNewEntry}
            onChange={(e) => {
              setLocalNewEntry(e.target.value)
              setDirty(true)
            }}
            placeholder={DEFAULT_DIARY_NEW_ENTRY_TEMPLATE}
            disabled={saving}
          />
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>{t('settings.diary_template_append', '追加记录模板')}</h3>
        <p className={styles.desc}>
          {t('settings.diary_template_append_desc', '在已有日记末尾追加新记录时插入的时间块。')}
        </p>
        {!hydrated ? (
          <div className={styles.loadingRow}>{t('common.loading', '加载中…')}</div>
        ) : (
          <textarea
            className={styles.textarea}
            value={localAppendBlock}
            onChange={(e) => {
              setLocalAppendBlock(e.target.value)
              setDirty(true)
            }}
            placeholder={DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE}
            disabled={saving}
          />
        )}
      </section>

      <section className={styles.card}>
        <p className={styles.hint}>
          {t(
            'settings.diary_template_vars_hint',
            '可用变量：{time} 当前时间 (HH:mm:ss)，{date} 日期 (yyyy-MM-dd)，{datetime} 完整日期时间'
          )}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => void handleReset()}
            disabled={!hydrated || saving}
          >
            {t('common.reset', '重置')}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {saving ? t('common.saving', '保存中…') : t('common.save', '保存')}
          </button>
        </div>
      </section>
    </div>
  )
}
