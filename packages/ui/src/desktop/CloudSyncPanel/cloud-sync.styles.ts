import type React from 'react'
import { sharedTokens } from '../../theme/tokens'

export const labelStyle: React.CSSProperties = {
  fontSize: 'var(--settings-font-label-size)',
  fontWeight: 500 as const,
  color: 'var(--text-primary)',
  display: 'block',
  marginBottom: sharedTokens.spacing.xs
}

export const passwordToggleButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'none',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
  padding: sharedTokens.spacing.xxs,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
