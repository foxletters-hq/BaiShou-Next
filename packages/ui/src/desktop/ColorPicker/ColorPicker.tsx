import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import './ColorPicker.css'

interface ColorPickerProps {
  value: string
  onChange: (hex: string) => void
  presets?: string[]
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  presets = ['#5BA8F5', '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF']
}) => {
  const { t } = useTranslation()
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className="color-picker-container">
      <div className="color-presets">
        {presets.map((color) => (
          <button
            key={color}
            className={`color-preset-btn ${color === value ? 'selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
      <div className="color-custom">
        <input
          type="color"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => onChange(localValue)}
          className="color-input"
          title={t('settings.custom_color')}
        />
        <span className="color-hex">{localValue.toUpperCase()}</span>
      </div>
    </div>
  )
}
