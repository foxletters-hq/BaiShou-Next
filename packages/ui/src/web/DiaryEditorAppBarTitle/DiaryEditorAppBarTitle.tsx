import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { smoothScrollToCenter } from '../../utils/scroll';
import { getPickerYearRange } from '../../utils/date';
import './DiaryEditorAppBarTitle.css';



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
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(selectedDate.getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(selectedDate.getDate());
  const pickerRef = useRef<HTMLDivElement>(null);
  const isInitialOpen = useRef(true);

  // 格式化标题
  const WEEKDAY_NAMES = Object.values(t('common.weekdays', { returnObjects: true }) as Record<string, string>);
  const MONTH_NAMES = t('common.months', { returnObjects: true }) as string[];

  const day = selectedDate.getDate();
  const weekday = WEEKDAY_NAMES[selectedDate.getDay()];
  const month = selectedDate.getMonth() + 1;
  const formattedDate = t('diary.date_format_editor_title', '{{year}}年{{month}}月{{day}}日 {{weekday}}', { year: selectedDate.getFullYear(), month, day, weekday });

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

  // 自动滚动选中项到中间
  useEffect(() => {
    if (!showPicker) {
      isInitialOpen.current = true;
      return undefined;
    }

    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    if (showPicker && pickerRef.current) {
      scrollTimer = setTimeout(() => {
        const selectedElements = pickerRef.current?.querySelectorAll('.dp-col-item.selected');
        selectedElements?.forEach((el) => {
          const container = el.parentElement as HTMLElement;
          if (container) {
            const duration = isInitialOpen.current ? 0 : 600;
            smoothScrollToCenter(container, el as HTMLElement, duration);
          }
        });
        isInitialOpen.current = false;
      }, 0); // 0ms delay so it starts instantly without noticeable pause
    }
    
    return () => {
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [showPicker, pickerYear, pickerMonth, pickerDay]);

  // {t('common.confirm', '确认')}选择
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

  // 生成年份选项: 全局同步算法
  const years = getPickerYearRange(false); // 不倒序，按原样从小到大

  // 生成当月天数
  const daysInSelectedMonth = new Date(pickerYear, pickerMonth, 0).getDate();
  const days = Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1);

  if (isSummaryMode) {
    return (
      <div className="diary-editor-app-bar-title">
        <span className="title-text">{t('diary.edit_summary', '编辑总结')}</span>
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
              {t('common.cancel', '取消')}
            </button>
            <span className="dp-header-title">{t('common.select_time', '选择日期')}</span>
            <button className="dp-header-btn dp-confirm-btn" onClick={handleConfirm}>
              {t('common.confirm', '确认')}
            </button>
          </div>
          <div className="dp-divider" />

          {/* Scrollable columns */}
          <div className="dp-columns">
            {/* Year */}
            <div className="dp-column">
              <div className="dp-col-label">{t("common.year_unit_label", "年")}</div>
              <div className="dp-col-scroll">
                {years.map(y => (
                  <div
                    key={y}
                    className={`dp-col-item ${y === pickerYear ? 'selected' : ''}`}
                    onClick={() => setPickerYear(y)}
                  >
                    {y}
                  </div>
                ))}
              </div>
            </div>

            {/* Month */}
            <div className="dp-column">
              <div className="dp-col-label">{t("common.month_unit_label", "月")}</div>
              <div className="dp-col-scroll">
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <div
                    key={m}
                    className={`dp-col-item ${m === pickerMonth ? 'selected' : ''}`}
                    onClick={() => setPickerMonth(m)}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* Day */}
            <div className="dp-column">
              <div className="dp-col-label">{t("common.day_unit_label", "日")}</div>
              <div className="dp-col-scroll">
                {days.map(d => (
                  <div
                    key={d}
                    className={`dp-col-item ${d === pickerDay ? 'selected' : ''}`}
                    onClick={() => setPickerDay(d)}
                  >
                    {d}
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
            >{t('common.today', '今天')}</button>
          </div>
        </div>
      )}
    </div>
  );
};
