import React from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  presets?: string[];
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const ColorPicker: React.FC<ColorPickerProps> = ({ 
  value, 
  onChange,
  presets = ['#5BA8F5', '#4CAF50', '#FF9800', '#F44336', '#9C27B0']
}) => {
  const { t } = useTranslation();

  return (
    <div className="color-picker-container">
      <div className="color-presets">
        {presets.map(color => (
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
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="color-input"
          title={t('settings.custom_color')}
        />
        <span className="color-hex">{value.toUpperCase()}</span>
      </div>
    </div>
  );
};
