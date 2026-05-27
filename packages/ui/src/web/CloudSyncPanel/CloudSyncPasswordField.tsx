import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { inputStyle, labelStyle, passwordToggleButtonStyle } from './cloud-sync.styles'

export interface CloudSyncPasswordFieldProps {
  label: string
  value: string
  showPassword: boolean
  onTogglePassword: () => void
  onChange: (value: string) => void
}

export const CloudSyncPasswordField: React.FC<CloudSyncPasswordFieldProps> = ({
  label,
  value,
  showPassword,
  onTogglePassword,
  onChange
}) => (
  <>
    <label style={labelStyle}>{label}</label>
    <div style={{ position: 'relative' }}>
      <input
        type={showPassword ? 'text' : 'password'}
        style={{ ...inputStyle, paddingRight: 36 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" style={passwordToggleButtonStyle} onClick={onTogglePassword}>
        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  </>
)
