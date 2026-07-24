import type React from 'react'

export const labelStyle: React.CSSProperties = {
  fontSize: 'var(--settings-font-label-size)',
  fontWeight: 500 as const,
  color: 'var(--text-primary)',
  display: 'block',
  marginBottom: 4
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 12px',
  border: '1.5px solid var(--form-field-border, var(--border-control))',
  borderRadius: 8,
  background: 'var(--form-field-bg, var(--bg-surface))',
  color: 'var(--text-primary)',
  fontSize: 'var(--settings-font-row-size)',
  fontFamily: 'inherit',
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
