import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_DIARY_AI_WRITING_PROMPT } from '@baishou/shared'
import { useToast } from '@baishou/ui'
import { useDiaryTemplateConfig } from '../hooks/useDiaryTemplateConfig'
import styles from './DiarySettingsPane.module.css'

function resolvePromptForEdit(configValue: string | undefined): string {
  const trimmed = configValue?.trim()
  return trimmed || DEFAULT_DIARY_AI_WRITING_PROMPT
}

export const DiaryAiWritingSettingsPane: React.FC = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { config, hydrated, saving, persist, persistMerge, reload } = useDiaryTemplateConfig()
  const [localPrompt, setLocalPrompt] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!hydrated || dirty) return
    setLocalPrompt(resolvePromptForEdit(config.aiWritingPrompt))
  }, [hydrated, config.aiWritingPrompt, dirty])

  const handleSave = async () => {
    try {
      const trimmed = localPrompt.trim()
      const saved = config.aiWritingPrompt?.trim()
      const isDefault = trimmed === DEFAULT_DIARY_AI_WRITING_PROMPT.trim()
      const next =
        isDefault && !saved
          ? await persistMerge({ aiWritingPrompt: undefined })
          : await persistMerge({ aiWritingPrompt: trimmed })
      setLocalPrompt(resolvePromptForEdit(next.aiWritingPrompt))
      setDirty(false)
      toast.showSuccess(t('settings.saved', '已保存'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    }
  }

  const handleReset = async () => {
    try {
      const latest = await reload()
      const { aiWritingPrompt: _removed, ...rest } = latest
      const next = await persist(rest)
      setLocalPrompt(resolvePromptForEdit(next.aiWritingPrompt))
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
            'settings.diary_partner_writing_desc',
            '定义伙伴在为用户记录日记时应遵守的格式与书写规范。'
          )}
        </p>
        <p className={styles.hint}>
          {t(
            'settings.diary_partner_writing_inject_hint',
            '此提示词仅在伙伴使用「写日记」「编辑日记」工具时注入，不会出现在普通对话中。'
          )}
        </p>
        {!hydrated ? (
          <div className={styles.loadingRow}>{t('common.loading', '加载中…')}</div>
        ) : (
          <textarea
            className={`${styles.textarea} ${styles.textareaLarge}`}
            value={localPrompt}
            onChange={(e) => {
              setLocalPrompt(e.target.value)
              setDirty(true)
            }}
            placeholder={DEFAULT_DIARY_AI_WRITING_PROMPT}
            disabled={saving}
          />
        )}
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
