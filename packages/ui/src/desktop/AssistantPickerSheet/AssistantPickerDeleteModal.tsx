import React from 'react'
import { Trash2 } from 'lucide-react'
import type { AssistantPickerSheetViewModel } from './useAssistantPickerSheet'

export function AssistantPickerDeleteModal({ vm }: { vm: AssistantPickerSheetViewModel }) {
  const { t, deleteTargetId, setDeleteTargetId, confirmDelete } = vm
  if (deleteTargetId === null) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={() => setDeleteTargetId(null)}
    >
      <div
        style={{
          width: '360px',
          background: 'var(--bg-surface, #fff)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '32px 24px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20
            }}
          >
            <Trash2 size={32} color="#ef4444" />
          </div>
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}
          >
            {t('agent.assistant.delete_confirm_title', 'Delete Companion?')}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}
          >
            {t('agent.assistant.delete_confirm_desc')}
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            padding: '16px 24px',
            gap: '12px',
            background: 'var(--bg-surface-highlight, #f8fafc)',
            borderTop: '1px solid rgba(148,163,184,0.1)'
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '15px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onClick={() => setDeleteTargetId(null)}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
            onClick={() => void confirmDelete()}
          >
            {t('common.confirm_delete', '确认删除')}
          </button>
        </div>
      </div>
    </div>
  )
}
