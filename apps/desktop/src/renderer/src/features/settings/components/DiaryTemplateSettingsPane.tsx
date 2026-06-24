import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE,
  DEFAULT_DIARY_NEW_ENTRY_TEMPLATE,
  previewDiaryAgentWritingGuidelines,
  resolveDiaryWritingStyleSupplement
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
  const [localSupplement, setLocalSupplement] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!hydrated || dirty) return
    setLocalNewEntry(config.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
    setLocalAppendBlock(config.appendBlockTemplate?.trimEnd() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
    setLocalSupplement(resolveDiaryWritingStyleSupplement(config))
  }, [hydrated, config, dirty])

  const agentPreview = useMemo(
    () =>
      previewDiaryAgentWritingGuidelines({
        newEntryTemplate: localNewEntry,
        appendBlockTemplate: localAppendBlock,
        writingStyleSupplement: localSupplement
      }),
    [localNewEntry, localAppendBlock, localSupplement]
  )

  const handleSave = async () => {
    try {
      const trimmedSupplement = localSupplement.trim()
      const next = await persistMerge({
        newEntryTemplate: localNewEntry.trim(),
        appendBlockTemplate: localAppendBlock.trimEnd(),
        writingStyleSupplement: trimmedSupplement || undefined,
        aiWritingPrompt: undefined
      })
      setLocalNewEntry(next.newEntryTemplate?.trim() || DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(next.appendBlockTemplate?.trimEnd() || DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setLocalSupplement(resolveDiaryWritingStyleSupplement(next))
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
        appendBlockTemplate: undefined,
        writingStyleSupplement: undefined,
        aiWritingPrompt: undefined
      })
      setLocalNewEntry(DEFAULT_DIARY_NEW_ENTRY_TEMPLATE)
      setLocalAppendBlock(DEFAULT_DIARY_APPEND_BLOCK_TEMPLATE)
      setLocalSupplement('')
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
        <p className={styles.desc}>
          {t(
            'settings.diary_format_unified_desc',
            '日记时间标题格式以下方模板为唯一来源，编辑器、伙伴写日记与系统提示词均遵循同一套模板。'
          )}
        </p>
      </section>

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
        <h3 className={styles.cardTitle}>
          {t('settings.diary_writing_style_supplement_title', '伙伴补充书写说明（可选）')}
        </h3>
        <p className={styles.desc}>
          {t(
            'settings.diary_writing_style_supplement_desc',
            '仅补充风格与内容要求（如人称、语气），不要在此重复定义时间标题格式。'
          )}
        </p>
        <p className={styles.hint}>
          {t(
            'settings.diary_partner_writing_inject_hint',
            '保存后会在伙伴使用「写日记」「编辑日记」工具时注入，不会出现在普通对话中。'
          )}
        </p>
        {!hydrated ? (
          <div className={styles.loadingRow}>{t('common.loading', '加载中…')}</div>
        ) : (
          <textarea
            className={`${styles.textarea} ${styles.textareaLarge}`}
            value={localSupplement}
            onChange={(e) => {
              setLocalSupplement(e.target.value)
              setDirty(true)
            }}
            placeholder={t(
              'settings.diary_writing_style_supplement_placeholder',
              '例如：用第一人称、简洁记录当下感受…'
            )}
            disabled={saving}
          />
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.cardTitle}>
          {t('settings.diary_agent_guidelines_preview', '伙伴将看到的格式规范（预览）')}
        </h3>
        <p className={styles.hint}>
          {t(
            'settings.diary_agent_guidelines_preview_hint',
            '由上方模板自动推导，无需单独维护格式提示词。'
          )}
        </p>
        <textarea
          className={`${styles.textarea} ${styles.textareaLarge} ${styles.preview}`}
          value={agentPreview}
          readOnly
          tabIndex={-1}
          aria-readonly
        />
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
