import React from 'react'
import { useTranslation } from 'react-i18next'

interface ShortcutManagerEditFormProps {
  draftName: string
  draftCommand: string
  draftContent: string
  onDraftNameChange: (v: string) => void
  onDraftCommandChange: (v: string) => void
  onDraftContentChange: (v: string) => void
  onCancel: () => void
  onSave: () => void
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: 6,
  display: 'block'
}

const fieldInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-surface)',
  outline: 'none',
  fontSize: 14
}

export const ShortcutManagerEditForm: React.FC<ShortcutManagerEditFormProps> = ({
  draftName,
  draftCommand,
  draftContent,
  onDraftNameChange,
  onDraftCommandChange,
  onDraftContentChange,
  onCancel,
  onSave
}) => {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={fieldLabel}>{t('shortcut.label_name', '指令标识名 (展示标签)')}</label>
        <input
          value={draftName}
          onChange={(e) => onDraftNameChange(e.target.value)}
          placeholder={t('shortcut.label_hint', '例如: Code Review')}
          style={fieldInput}
        />
      </div>
      <div>
        <label style={fieldLabel}>{t('shortcut.command_label', '指令命令 (用于触发)')}</label>
        <input
          value={draftCommand}
          onChange={(e) => onDraftCommandChange(e.target.value)}
          placeholder={t('shortcut.command_hint', '例如: review, translate')}
          style={fieldInput}
        />
      </div>
      <div>
        <label style={fieldLabel}>{t('shortcut.content_prompt', '实际注入内容 (Prompt)')}</label>
        <textarea
          value={draftContent}
          onChange={(e) => onDraftContentChange(e.target.value)}
          placeholder={t('shortcut.content_hint', '在此输入将会插入到对话框的长文本预设指令...')}
          style={{ ...fieldInput, minHeight: '120px', resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!draftContent.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: !draftContent.trim() ? 0.5 : 1
          }}
        >
          {t('common.save', '保存')}
        </button>
      </div>
    </div>
  )
}
