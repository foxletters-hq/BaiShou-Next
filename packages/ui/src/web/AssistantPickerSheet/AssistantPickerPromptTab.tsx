import React from 'react'
import { AlignLeft, Command } from 'lucide-react'
import { MdAutoAwesome } from 'react-icons/md'
import { normalizeAssistantKind } from '@baishou/shared'
import { HelpTooltip } from '../HelpTooltip'
import { AssistantKindTabBar } from '../AssistantKindTabBar'
import { ResizableMarkdownEditor } from '../ResizableMarkdownEditor'
import { getProviderIcon } from '../../utils/provider-icons'
import { useTheme } from '../../hooks'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantInfo } from './assistant-picker-sheet.types'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'

function SectionHeader({
  icon,
  title,
  hint
}: {
  icon: React.ReactNode
  title: string
  hint: string
}) {
  return (
    <div className={styles.sectionHeader}>
      {icon}
      <h3 className={styles.sectionTitle}>{title}</h3>
      <HelpTooltip content={hint} />
    </div>
  )
}

export function AssistantPickerPromptTab({
  vm,
  activeAssistant
}: {
  vm: AssistantPickerSheetViewModel
  activeAssistant: AssistantInfo
}) {
  const {
    t,
    editingDescription,
    setEditingDescription,
    saveDescription,
    editingPrompt,
    setEditingPrompt,
    saveConfig,
    updateAssistantAPI,
    setShowModelSwitcher,
    providers
  } = vm
  const { isDark } = useTheme()

  const providerId = activeAssistant.providerId
  const providerRecord = providers.find((p) => (p.id || p.providerId) === providerId)
  const providerIconSrc = providerId
    ? getProviderIcon(providerId, isDark) || getProviderIcon(providerRecord?.type, isDark)
    : undefined

  const handleRestoreGlobalModel = (e: React.MouseEvent) => {
    e.stopPropagation()
    void updateAssistantAPI(activeAssistant.id, {
      providerId: null,
      modelId: null
    })
  }

  const descriptionHint = t('agent.assistant.description_hint', '简短描述伙伴的用途...')
  const promptHint = t('agent.assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')

  return (
    <>
      <div className={styles.partnerKindSection}>
        <AssistantKindTabBar
          activeKind={normalizeAssistantKind(activeAssistant.assistantKind)}
          onKindChange={(kind) => {
            void updateAssistantAPI(activeAssistant.id, { assistantKind: kind })
          }}
        />
      </div>

      <SectionHeader
        icon={<AlignLeft size={18} color="var(--color-primary)" />}
        title={t('agent.assistant.description_label', '简介')}
        hint={descriptionHint}
      />
      <ResizableMarkdownEditor
        content={editingDescription}
        onChange={(value) => setEditingDescription(value || '')}
        onBlur={() => void saveDescription()}
        placeholder={descriptionHint}
        defaultHeight={96}
        minHeight={72}
        maxHeight={240}
      />

      <SectionHeader
        icon={<Command size={18} color="var(--color-primary)" />}
        title={t('agent.assistant.prompt_label', '系统提示词')}
        hint={promptHint}
      />
      <ResizableMarkdownEditor
        content={editingPrompt}
        onChange={(value) => setEditingPrompt(value || '')}
        onBlur={() => saveConfig()}
        placeholder={promptHint}
        defaultHeight={180}
        minHeight={120}
        maxHeight={520}
      />

      <SectionHeader
        icon={<MdAutoAwesome size={18} color="var(--color-primary)" />}
        title={t('agent.assistant.bind_model_label', '绑定模型')}
        hint={t(
          'agent.assistant.bind_model_desc',
          '绑定后，和伙伴创建对话时，会默认优先使用选择的模型'
        )}
      />
      <div className={styles.modelSelectorArea} onClick={() => setShowModelSwitcher(true)}>
        <div className={styles.modelSelectorIcon}>
          {providerIconSrc ? (
            <img src={providerIconSrc} alt={providerId || ''} />
          ) : (
            <MdAutoAwesome size={22} color="var(--color-primary)" />
          )}
        </div>
        <div className={styles.modelSelectorInfo}>
          {activeAssistant.providerId ? (
            <>
              <span className={styles.modelSelectorProvider}>{activeAssistant.providerId}</span>
              <span className={styles.modelSelectorModel}>{activeAssistant.modelId}</span>
            </>
          ) : (
            <span className={styles.modelSelectorPlaceholder}>
              {t('agent.assistant.use_global_model', '使用全局模型')}
            </span>
          )}
        </div>
      </div>
      {activeAssistant.providerId ? (
        <button
          type="button"
          className={styles.restoreDefaultBtn}
          onClick={handleRestoreGlobalModel}
        >
          {t('common.restore_default', '恢复默认')}
        </button>
      ) : null}
    </>
  )
}
