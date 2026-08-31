import type React from 'react'

export const labelStyle: React.CSSProperties = {
  fontSize: 'var(--settings-font-label-size)',
  fontWeight: 500 as const,
  color: 'var(--text-primary)',
  display: 'block',
  marginBottom: 4
}

export const passwordToggleButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
