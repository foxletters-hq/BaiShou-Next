import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  SYSTEM_LATTE_ASSISTANT_ID,
  getDefaultLatteAssistantSystemPrompt
} from '@baishou/shared'
import { HelpTooltip, SettingsPageChrome, useDialog, useToast } from '@baishou/ui'
import { useAssistantStore } from '@baishou/store'
import styles from './DiarySettingsPane.module.css'
import pane from './GeneralSettingsPane.module.css'

type LatteAssistantRow = {
  id: string
  systemPrompt?: string | null
  customSystemPrompt?: string | null
}

export const LatteSettingsPane: React.FC = () => {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [personaPrompt, setPersonaPrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [dirty, setDirty] = useState(false)

  const loadLatte = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      if (!window.api?.ensureSystemLatteAssistant) {
        throw new Error('ensureSystemLatteAssistant unavailable')
      }
      await window.api.ensureSystemLatteAssistant(i18n.language)
      const list = (await window.api.getAssistants?.()) as LatteAssistantRow[] | undefined
      const latte = (list ?? []).find((a) => a.id === SYSTEM_LATTE_ASSISTANT_ID)
      if (!latte) {
        throw new Error('system latte missing')
      }
      setPersonaPrompt(latte.systemPrompt ?? '')
      setCustomPrompt(latte.customSystemPrompt ?? '')
      setDirty(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [i18n.language])

  useEffect(() => {
    void loadLatte()
  }, [loadLatte])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.updateAssistant?.(SYSTEM_LATTE_ASSISTANT_ID, {
        systemPrompt: personaPrompt,
        customSystemPrompt: customPrompt
      })
      await useAssistantStore.getState().fetchAssistants()
      setDirty(false)
      toast.showSuccess(t('settings.saved', '已保存'))
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const handleFetchLatest = async () => {
    const confirmed = await dialog.confirm(
      t(
        'settings.latte_fetch_latest_confirm',
        '将用人设官方文案覆盖当前人设提示词，自定义提示词不会改动。覆盖后仍需点击保存才会生效。'
      ),
      t('settings.latte_fetch_latest_confirm_title', '获取最新人设？')
    )
    if (!confirmed) return
    setPersonaPrompt(getDefaultLatteAssistantSystemPrompt(i18n.language))
    setDirty(true)
    toast.showSuccess(t('settings.latte_fetch_latest_done', '已写入最新人设提示词，请保存'))
  }

  return (
    <SettingsPageChrome
      title={t('settings.latte_settings_title', 'Latte')}
      titleAccessory={
        <HelpTooltip
          size={14}
          content={t(
            'settings.latte_settings_desc',
            '管理系统特殊伙伴 Latte 的人设与自定义提示词。升级不会改写你已有的其他伙伴。'
          )}
        />
      }
    >
      <div className={pane.stack}>
        {loading ? (
          <div className={styles.loadingRow}>
            {t('settings.latte_ensure_loading', '正在准备系统伙伴 Latte…')}
          </div>
        ) : null}

        {loadError ? (
          <div className={pane.stackGroup}>
            <div className={styles.loadingRow}>
              {t('settings.latte_ensure_failed', '无法创建或读取系统伙伴 Latte')}
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void loadLatte()}
              >
                {t('common.retry', '重试')}
              </button>
            </div>
          </div>
        ) : null}

        {!loading && !loadError ? (
          <>
            <div className={pane.stackGroup}>
              <div className={pane.sectionLabelRow}>
                <h3 className={pane.sectionLabel}>
                  {t('settings.latte_persona_prompt_title', '人设提示词')}
                </h3>
                <HelpTooltip
                  size={14}
                  content={t(
                    'settings.latte_persona_prompt_desc',
                    '系统伙伴 Latte 的官方人设。可手动编辑，或获取最新官方文案（不会改动下方自定义段）。'
                  )}
                />
              </div>
              <section className={pane.cardSection}>
                <div className={styles.sectionBody}>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    value={personaPrompt}
                    onChange={(e) => {
                      setPersonaPrompt(e.target.value)
                      setDirty(true)
                    }}
                    placeholder={t('settings.latte_persona_prompt_hint', 'Latte 的人设…')}
                    disabled={saving}
                  />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => void handleFetchLatest()}
                      disabled={saving}
                    >
                      {t('settings.latte_fetch_latest', '获取最新')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={() => void handleSave()}
                      disabled={saving || !dirty}
                    >
                      {saving ? t('common.saving', '保存中…') : t('common.save', '保存')}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className={pane.stackGroup}>
              <div className={pane.sectionLabelRow}>
                <h3 className={pane.sectionLabel}>
                  {t('settings.latte_custom_prompt_title', '自定义提示词')}
                </h3>
                <HelpTooltip
                  size={14}
                  content={t(
                    'settings.latte_custom_prompt_desc',
                    '会接在人设提示词之后一并注入对话。留空则仅使用人设。'
                  )}
                />
              </div>
              <section className={pane.cardSection}>
                <div className={styles.sectionBody}>
                  <textarea
                    className={`${styles.textarea} ${styles.textareaLarge}`}
                    value={customPrompt}
                    onChange={(e) => {
                      setCustomPrompt(e.target.value)
                      setDirty(true)
                    }}
                    placeholder={t(
                      'settings.latte_custom_prompt_hint',
                      '额外补充说明、偏好或规则…'
                    )}
                    disabled={saving}
                  />
                </div>
              </section>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void handleSave()}
                disabled={saving || !dirty}
              >
                {saving ? t('common.saving', '保存中…') : t('common.save', '保存')}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </SettingsPageChrome>
  )
}
