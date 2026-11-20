import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, Sparkles } from 'lucide-react'
import type { AssistantKind } from '@baishou/shared'
import {
  AssistantAvatar,
  AssistantAvatarPicker,
  AssistantKindBadge,
  AssistantKindTabBar,
  Button,
  getProviderIcon,
  Input,
  SegmentedControl,
  useTheme
} from '@baishou/ui'
import type {
  DesktopAssistantItem,
  DesktopDeepSeekTargetMode
} from '../hooks/useDesktopDeepSeekImport'
import pane from './GeneralSettingsPane.module.css'
import styles from './DeepSeekImportPane.module.css'

export interface DeepSeekImportTargetSectionProps {
  targetMode: DesktopDeepSeekTargetMode
  onChangeTargetMode: (mode: DesktopDeepSeekTargetMode) => void
  assistants: DesktopAssistantItem[]
  loadingAssistants: boolean
  selectedAssistantId: string
  onSelectAssistant: (id: string) => void
  newAssistantKind: AssistantKind
  onChangeNewAssistantKind: (kind: AssistantKind) => void
  newAssistantName: string
  onChangeNewAssistantName: (value: string) => void
  newAssistantDescription: string
  onChangeNewAssistantDescription: (value: string) => void
  newAssistantSystemPrompt: string
  onChangeNewAssistantSystemPrompt: (value: string) => void
  newAssistantAvatarPath: string
  onChangeNewAssistantAvatarPath: (path: string) => void
  newAssistantProviderId?: string
  newAssistantModelId?: string
  onOpenModelSwitcher: () => void
  onClearModelBinding: () => void
  disabled?: boolean
}

export const DeepSeekImportTargetSection: React.FC<DeepSeekImportTargetSectionProps> = ({
  targetMode,
  onChangeTargetMode,
  assistants,
  loadingAssistants,
  selectedAssistantId,
  onSelectAssistant,
  newAssistantKind,
  onChangeNewAssistantKind,
  newAssistantName,
  onChangeNewAssistantName,
  newAssistantDescription,
  onChangeNewAssistantDescription,
  newAssistantSystemPrompt,
  onChangeNewAssistantSystemPrompt,
  newAssistantAvatarPath,
  onChangeNewAssistantAvatarPath,
  newAssistantProviderId,
  newAssistantModelId,
  onOpenModelSwitcher,
  onClearModelBinding,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { isDark } = useTheme()

  const modeOptions = useMemo(
    () => [
      { value: 'existing' as const, label: t('deepseek_import.target_mode_existing') },
      { value: 'new' as const, label: t('deepseek_import.target_mode_new') }
    ],
    [t]
  )

  const boundProviderIcon = newAssistantProviderId
    ? getProviderIcon(newAssistantProviderId, isDark)
    : undefined

  return (
    <div className={pane.stackGroup}>
      <div className={pane.sectionLabelRow}>
        <h3 className={pane.sectionLabel}>{t('deepseek_import.target_section_title')}</h3>
      </div>

      <section className={pane.cardSection}>
        <div className={styles.targetCardBody}>
          <SegmentedControl
            value={targetMode}
            options={modeOptions}
            onChange={onChangeTargetMode}
            size="small"
            disabled={disabled}
            aria-label={t('deepseek_import.target_section_title')}
          />

          {targetMode === 'existing' ? (
            loadingAssistants ? (
              <p className={styles.metaLine}>{t('common.loading')}</p>
            ) : assistants.length === 0 ? (
              <p className={styles.metaLine}>{t('deepseek_import.existing_empty')}</p>
            ) : (
              <div className={styles.assistantList}>
                {assistants.map((assistant) => {
                  const selected = assistant.id === selectedAssistantId
                  return (
                    <button
                      key={assistant.id}
                      type="button"
                      disabled={disabled}
                      className={`${styles.assistantRow} ${selected ? styles.assistantRowSelected : ''}`}
                      onClick={() => onSelectAssistant(assistant.id)}
                    >
                      <AssistantAvatar avatarPath={assistant.avatarPath} size={36} />
                      <div className={styles.assistantMeta}>
                        <div className={styles.assistantNameRow}>
                          <span className={styles.assistantName}>{assistant.name}</span>
                          <AssistantKindBadge kind={assistant.assistantKind} compact />
                        </div>
                        {assistant.description ? (
                          <span className={styles.assistantDesc}>{assistant.description}</span>
                        ) : null}
                      </div>
                      {selected ? <Check size={16} className={styles.checkIcon} /> : null}
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <div className={styles.newAssistantGrid}>
              <div className={styles.newAssistantCol}>
                <div className={styles.avatarBox}>
                  <AssistantAvatarPicker
                    avatarPath={newAssistantAvatarPath}
                    previewSize={84}
                    onSelectBuiltin={onChangeNewAssistantAvatarPath}
                    onUploadImage={onChangeNewAssistantAvatarPath}
                  />
                  <span className={styles.hintLine}>{t('common.edit_avatar')}</span>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{t('agent.assistant.name_label')}</label>
                  <Input
                    fieldSize="small"
                    value={newAssistantName}
                    onChange={(e) => onChangeNewAssistantName(e.target.value)}
                    placeholder={t('agent.assistant.name_hint')}
                    disabled={disabled}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    {t('agent.assistant.description_label')}
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    value={newAssistantDescription}
                    onChange={(e) => onChangeNewAssistantDescription(e.target.value)}
                    placeholder={t('agent.assistant.description_hint')}
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className={styles.newAssistantCol}>
                <AssistantKindTabBar
                  variant="cards"
                  activeKind={newAssistantKind}
                  onKindChange={onChangeNewAssistantKind}
                />

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>{t('agent.assistant.prompt_label')}</label>
                  <textarea
                    className={styles.textarea}
                    rows={6}
                    value={newAssistantSystemPrompt}
                    onChange={(e) => onChangeNewAssistantSystemPrompt(e.target.value)}
                    placeholder={t('agent.assistant.prompt_hint')}
                    disabled={disabled}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabelRow}>
                    <label className={styles.fieldLabel}>
                      {t('agent.assistant.bind_model_label')}
                    </label>
                    {newAssistantProviderId ? (
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        disabled={disabled}
                        onClick={onClearModelBinding}
                      >
                        {t('agent.assistant.use_global_model')}
                      </Button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    disabled={disabled}
                    className={styles.modelCard}
                    onClick={onOpenModelSwitcher}
                  >
                    <span className={styles.modelIconWrap}>
                      {boundProviderIcon ? (
                        <img
                          src={boundProviderIcon}
                          alt={newAssistantProviderId}
                          className={styles.modelIconImg}
                        />
                      ) : (
                        <Sparkles size={18} />
                      )}
                    </span>
                    <span className={styles.modelInfo}>
                      {newAssistantProviderId ? (
                        <>
                          <span className={styles.modelSup}>{newAssistantProviderId}</span>
                          <span className={styles.modelSub}>{newAssistantModelId}</span>
                        </>
                      ) : (
                        <span className={styles.modelSub}>
                          {t('agent.assistant.select_model_label')}
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} />
                  </button>

                  <p className={styles.hintLine}>{t('agent.assistant.bind_model_desc')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
