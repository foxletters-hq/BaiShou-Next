import React from 'react'
import { Command, Star, X } from 'lucide-react'
import { MdCloud } from 'react-icons/md'
import { CodeMirrorEditor } from '../DiaryEditor/CodeMirrorEditor'
import { HelpTooltip } from '../HelpTooltip'
import { getProviderIcon } from '../../utils/provider-icons'
import { useTheme } from '../../hooks'
import styles from './AssistantPickerSheet.module.css'
import type { AssistantInfo } from './assistant-picker-sheet.types'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'

export function AssistantPickerPromptTab({
  vm,
  activeAssistant
}: {
  vm: AssistantPickerSheetViewModel
  activeAssistant: AssistantInfo
}) {
  const {
    t,
    editingPrompt,
    setEditingPrompt,
    saveConfig,
    updateAssistantAPI,
    setShowModelSwitcher,
    providers
  } = vm
  const { isDark } = useTheme()

  const providerId = activeAssistant.providerId
  const providerRecord = providers.find(
    (p) => (p.id || p.providerId) === providerId
  )
  const providerIconSrc = providerId
    ? getProviderIcon(providerId, isDark) ||
      getProviderIcon(providerRecord?.type, isDark)
    : undefined

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 8,
          gap: 8
        }}
      >
        <Command size={18} color="var(--color-primary)" />
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
          {t('agent.assistant.prompt_label', '系统提示词')}
        </h3>
        <HelpTooltip
          content={t(
            'agent.assistant.prompt_hint',
            '定义伙伴的角色、行为和回复风格...'
          )}
        />
      </div>
      <div
        className={styles.promptEditorArea}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            saveConfig()
          }
        }}
      >
        <CodeMirrorEditor
          content={editingPrompt}
          onChange={(val: string) => setEditingPrompt(val || '')}
          placeholder={t('agent.assistant.prompt_hint', '定义伙伴的角色、行为和回复风格...')}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 24,
          marginBottom: 8,
          gap: 8
        }}
      >
        <Star size={18} color="var(--color-primary)" />
        <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
          {t('agent.assistant.bind_model_label', '绑定模型')}
        </h3>
        <HelpTooltip
          content={t(
            'agent.assistant.bind_model_desc',
            '绑定后，和伙伴创建对话时，会默认优先使用选择的模型'
          )}
        />
      </div>
      <div className={styles.modelSelectorArea} onClick={() => setShowModelSwitcher(true)}>
        <div className={styles.modelSelectorIcon}>
          {providerIconSrc ? (
            <img src={providerIconSrc} alt={providerId || ''} />
          ) : (
            <MdCloud size={24} color="var(--text-tertiary)" />
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
        {activeAssistant.providerId && (
          <X
            size={16}
            color="var(--text-secondary)"
            onClick={(e) => {
              e.stopPropagation()
              updateAssistantAPI(activeAssistant.id, {
                providerId: null,
                modelId: null
              })
            }}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          />
        )}
      </div>
    </>
  )
}
