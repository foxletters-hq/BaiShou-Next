import React from 'react'
import type { TFunction } from 'i18next'

interface RenameTarget {
  id: string
  title: string
}

interface AgentSessionRenameModalProps {
  renameTarget: RenameTarget
  renameInputRef: React.RefObject<HTMLInputElement | null>
  t: TFunction
  onClose: () => void
  onTitleChange: (title: string) => void
  onCommit: () => void
}

export const AgentSessionRenameModal: React.FC<AgentSessionRenameModalProps> = ({
  renameTarget,
  renameInputRef,
  t,
  onClose,
  onTitleChange,
  onCommit
}) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.3)'
    }}
    onClick={onClose}
  >
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 16,
        padding: '24px 24px 16px',
        width: 320,
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontWeight: '600',
          fontSize: 15,
          marginBottom: 12,
          color: 'var(--text-primary)'
        }}
      >
        {t('agent.rename_session', '重命名对话')}
      </div>
      <input
        ref={renameInputRef}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(148,163,184,0.4)',
          fontSize: 14,
          outline: 'none',
          background: 'var(--bg-surface-highlight)',
          color: 'var(--text-primary)',
          boxSizing: 'border-box'
        }}
        value={renameTarget.title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onClose()
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--text-secondary)'
          }}
          onClick={onClose}
        >
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--color-primary)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600
          }}
          onClick={onCommit}
        >
          {t('common.confirm', '确定')}
        </button>
      </div>
    </div>
  </div>
)
