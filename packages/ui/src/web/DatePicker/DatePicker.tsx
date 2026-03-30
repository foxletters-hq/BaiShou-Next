import React from 'react';
import './DatePicker.css';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: 'date' | 'month' | 'year'; // 年、年月、年月日
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, mode = 'date' }) => {
  const { t } = useTranslation();

  // 临时使用原生 input date 验证逻辑
  const toLocalISOString = (date: Date) => {
    const tzoffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 10);
    return localISOTime;
  }

  return (
    <div className="date-picker-container">
      <input 
        type={mode === 'month' ? 'month' : 'date'}
        value={toLocalISOString(value)}
        onChange={(e) => {
          if (e.target.value) {
            onChange(new Date(e.target.value));
          }
        }}
        className="date-picker-input"
        title={t('common.select_date')}
      />
    </div>
  );
};
