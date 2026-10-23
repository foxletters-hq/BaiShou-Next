import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SummarySettingsView.module.css'
import stack from '../shared/SettingsStack.module.css'
import { HelpTooltip } from '../HelpTooltip'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Button } from '../Button/Button'
import { Modal } from '../Modal/Modal'
import { resolveDesktopAssistantAvatarSrc } from '../assistant-avatar.util'
import { SUMMARY_PROMPT_LOCALE_OPTIONS } from '@baishou/shared'
import type { SummarySettingsAssistantOption } from './summary-settings.types'
import type { SummarySettingsViewModel } from './useSummarySettingsView'

function renderPartnerAvatar(assistant?: SummarySettingsAssistantOption) {
  const src = resolveDesktopAssistantAvatarSrc(assistant?.avatarPath)
  return (
    <span
      className={styles.partnerAvatar}
      aria-hidden
      style={{ backgroundImage: `url("${src}")` }}
    />
  )
}

export function SummaryGenerationSection({ vm }: { vm: SummarySettingsViewModel }) {
  const { t } = useTranslation()
  const { config, assistants } = vm

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>
          {t('settings.summary_generation_mode_title', 'Generation mode')}
        </h3>
        <HelpTooltip
          size={14}
          content={t(
            'settings.summary_generation_mode_desc',
            'Write a custom generation-assistant prompt, or reuse a partner’s persona. Both modes use the global summary model.'
          )}
        />
      </div>
      <section className={stack.cardSection}>
        <div className={styles.sectionBody}>
          <SegmentedControl
            value={config.generationMode}
            options={[
              {
                value: 'prompt',
                label: t('settings.summary_generation_mode_prompt', 'Custom prompt')
              },
              {
                value: 'assistant',
                label: t('settings.summary_generation_mode_assistant', 'Reuse partner')
              }
            ]}
            onChange={(generationMode) => {
              if (generationMode === 'prompt') {
                vm.emitSettings({ generationMode: 'prompt' })
                return
              }
              if (assistants.length === 0) {
                vm.toast.showError(
                  t(
                    'settings.summary_generation_assistant_required',
                    'Select a partner, or switch back to custom prompt mode'
                  )
                )
                return
              }
              const nextId =
                config.generationAssistantId &&
                assistants.some((a) => a.id === config.generationAssistantId)
                  ? config.generationAssistantId
                  : assistants[0]!.id
              vm.emitSettings({
                generationMode: 'assistant',
                generationAssistantId: nextId
              })
            }}
          />

          {config.generationMode === 'prompt' && (
            <div className={styles.systemPromptBlock}>
              <div className={styles.subsectionTitleRow}>
                <div className={styles.subsectionTitle}>
                  {t('settings.summary_custom_system_prompt_title', 'Generation assistant prompt')}
                </div>
                <HelpTooltip
                  size={14}
                  content={t(
                    'settings.summary_custom_system_prompt_desc',
                    'System prompt for the summary-writing assistant in custom prompt mode. Empty falls back to the built-in default.'
                  )}
                />
              </div>
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
                {t('settings.summary_prompt_locale_hint', '正在编辑提示词语言')}:{' '}
                <strong>{vm.activeLocaleLabel}</strong>
              </p>
              <textarea
                className={styles.systemPromptArea}
                value={vm.localSystemPrompt}
                onChange={(e) => {
                  vm.systemPromptDirtyRef.current = true
                  vm.setLocalSystemPrompt(e.target.value)
                }}
                onBlur={() => vm.emitSettings()}
                rows={8}
                placeholder={t(
                  'settings.summary_custom_system_prompt_hint',
                  'e.g. You are a warm memory companion who writes concise, faithful summaries…'
                )}
              />
              <div className={styles.actionsRow}>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={vm.handleResetSystemPrompt}
                >
                  {t('settings.restore_default', 'Restore default')}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    vm.emitSettings()
                    vm.toast.showSuccess(t('settings.saved', 'Saved'))
                  }}
                >
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          )}

          {config.generationMode === 'assistant' && (
            <div className={styles.assistantPickRow}>
              <div className={styles.subsectionTitle}>
                {t('settings.summary_generation_assistant_label', 'Summary generation partner')}
              </div>
              <button
                type="button"
                className={styles.partnerCard}
                onClick={() => vm.setPartnerPickerOpen(true)}
              >
                {renderPartnerAvatar(vm.selectedPartner)}
                <span className={styles.partnerMeta}>
                  <span className={styles.partnerName}>
                    {vm.selectedPartner?.name ||
                      t('settings.summary_generation_assistant_placeholder', 'Choose a partner')}
                  </span>
                  <span className={styles.partnerHint}>
                    {t('settings.summary_generation_partner_change', 'Tap to change')}
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
      </section>

      <Modal
        isOpen={vm.partnerPickerOpen}
        onClose={() => vm.setPartnerPickerOpen(false)}
        title={t('settings.summary_generation_assistant_placeholder', 'Choose a partner')}
        closeOnOverlayClick
      >
        <div className={styles.partnerPickerList}>
          {assistants.length === 0 ? (
            <p className={styles.emptyHint}>
              {t(
                'settings.summary_generation_assistant_required',
                'Create a partner first, then come back.'
              )}
            </p>
          ) : (
            assistants.map((a) => {
              const active = a.id === config.generationAssistantId
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.partnerPickerItem} ${active ? styles.partnerPickerItemActive : ''}`}
                  onClick={() => {
                    vm.emitSettings({
                      generationMode: 'assistant',
                      generationAssistantId: a.id
                    })
                    vm.setPartnerPickerOpen(false)
                  }}
                >
                  {renderPartnerAvatar(a)}
                  <span className={styles.partnerName}>{a.name}</span>
                </button>
              )
            })
          )}
        </div>
      </Modal>
    </div>
  )
}
