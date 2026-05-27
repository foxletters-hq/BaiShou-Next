import React from 'react'
import { Command, Star, X } from 'lucide-react'
import { CodeMirrorEditor } from '../DiaryEditor/CodeMirrorEditor'
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
    setShowModelSwitcher
  } = vm
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
      </div>
      <div
        style={{
          width: '100%',
          height: 180,
          border: '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.3)',
          borderRadius: 12,
          outline: 'none',
          background: 'transparent',
          overflowY: 'auto'
        }}
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
      </div>
      <div
        className={styles.modelSelectorArea}
        onClick={() => setShowModelSwitcher(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          borderRadius: 12,
          border: '1px solid rgba(var(--color-outline-variant-rgb, 200, 200, 200), 0.3)',
          background: 'var(--bg-surface-highlight, rgba(248, 250, 252, 0.2))',
          padding: '14px 16px',
          gap: 12
        }}
      >
        <Command size={18} color="var(--color-primary)" />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {activeAssistant.providerId ? (
            <>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-secondary)'
                }}
              >
                {activeAssistant.providerId}
              </span>
              <span style={{ fontSize: 13, fontWeight: 'bold' }}>{activeAssistant.modelId}</span>
            </>
          ) : (
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)'
              }}
            >
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
            style={{ cursor: 'pointer' }}
          />
        )}
      </div>
    </>
  )
}
