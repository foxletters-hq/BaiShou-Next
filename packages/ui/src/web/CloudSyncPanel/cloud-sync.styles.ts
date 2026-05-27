import type React from 'react'

export const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 4
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border-muted)',
  borderRadius: '6px',
  background: 'var(--bg-surface-low)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  boxSizing: 'border-box'
}

export const passwordToggleButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  top: '50%',
  transform: 'translateY(-50%)',
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
