import React, { useState, useRef, useEffect } from 'react';
import './DiaryEditorAppBarTitle.css';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface DiaryEditorAppBarTitleProps {
  isSummaryMode: boolean;
  selectedDate: Date;
  onDateChanged: (date: Date) => void;
}

export const DiaryEditorAppBarTitle: React.FC<DiaryEditorAppBarTitleProps> = ({
  isSummaryMode,
  selectedDate,
  onDateChanged
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(selectedDate.getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(selectedDate.getDate());
  const pickerRef = useRef<HTMLDivElement>(null);

  // 格式化标题
  const day = selectedDate.getDate();
  const weekday = WEEKDAY_NAMES[selectedDate.getDay()];
  const month = MONTH_NAMES[selectedDate.getMonth()];
  const formattedDate = `${selectedDate.getFullYear()}年${month}${day}日 ${weekday}`;

  // 当日期变化时同步pickerState
  useEffect(() => {
    setPickerYear(selectedDate.getFullYear());
    setPickerMonth(selectedDate.getMonth() + 1);
    setPickerDay(selectedDate.getDate());
  }, [selectedDate]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // 确认选择
  const handleConfirm = () => {
    const daysInMonth = new Date(pickerYear, pickerMonth, 0).getDate();
    const safeDay = Math.min(pickerDay, daysInMonth);
    const newDate = new Date(selectedDate);
    newDate.setFullYear(pickerYear);
    newDate.setMonth(pickerMonth - 1);
    newDate.setDate(safeDay);
    onDateChanged(newDate);
    setShowPicker(false);
  };

  // 生成年份选项
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  // 生成当月天数
  const daysInSelectedMonth = new Date(pickerYear, pickerMonth, 0).getDate();
  const days = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  if (isSummaryMode) {
    return (
      <div className="diary-editor-app-bar-title">
        <span className="title-text">编辑总结</span>
      </div>
    );
  }

  return (
    <div className="diary-editor-app-bar-title" ref={pickerRef}>
      <div className="title-content" onClick={() => setShowPicker(!showPicker)}>
        <span className="title-text">{formattedDate}</span>
        <span className="title-chevron">▾</span>
      </div>

      {showPicker && (
        <div className="date-picker-dropdown" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="dp-header">
            <button className="dp-header-btn dp-cancel-btn" onClick={() => setShowPicker(false)}>
              取消
            </button>
            <span className="dp-header-title">选择日期</span>
            <button className="dp-header-btn dp-confirm-btn" onClick={handleConfirm}>
              确认
            </button>
          </div>
          <div className="dp-divider" />

          {/* Scrollable columns */}
          <div className="dp-columns">
            {/* Year */}
            <div className="dp-column">
              <div className="dp-col-label">年</div>
              <div className="dp-col-scroll">
                {years.map(y => (
                  <div
                    key={y}
                    className={`dp-col-item ${y === pickerYear ? 'selected' : ''}`}
                    onClick={() => setPickerYear(y)}
                  >
                    {y}年
                  </div>
                ))}
              </div>
            </div>

            {/* Month */}
            <div className="dp-column">
              <div className="dp-col-label">月</div>
              <div className="dp-col-scroll">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <div
                    key={m}
                    className={`dp-col-item ${m === pickerMonth ? 'selected' : ''}`}
                    onClick={() => setPickerMonth(m)}
                  >
                    {m}月
                  </div>
                ))}
              </div>
            </div>

            {/* Day */}
            <div className="dp-column">
              <div className="dp-col-label">日</div>
              <div className="dp-col-scroll">
                {days.map(d => (
                  <div
                    key={d}
                    className={`dp-col-item ${d === pickerDay ? 'selected' : ''}`}
                    onClick={() => setPickerDay(d)}
                  >
                    {d}日
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="dp-divider" />
          <div className="dp-quick-actions">
            <button
              className="dp-quick-btn"
              onClick={() => {
                const now = new Date();
                setPickerYear(now.getFullYear());
                setPickerMonth(now.getMonth() + 1);
                setPickerDay(now.getDate());
              }}
            >
              今天
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
