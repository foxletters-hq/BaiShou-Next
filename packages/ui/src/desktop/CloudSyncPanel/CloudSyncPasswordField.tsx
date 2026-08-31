import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '../Input/Input'
import { labelStyle, passwordToggleButtonStyle } from './cloud-sync.styles'

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
    <Input
      fieldSize="small"
      type={showPassword ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      trailing={
        <button type="button" style={passwordToggleButtonStyle} onClick={onTogglePassword}>
          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      }
    />
  </>
)
