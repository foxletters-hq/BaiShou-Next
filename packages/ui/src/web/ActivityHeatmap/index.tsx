import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import styles from './ActivityHeatmap.module.css';

import { generateHeatmapMatrix, ActivityData } from '../../utils/heatmap-matrix';
import { useTranslation } from 'react-i18next';

interface ActivityHeatmapProps {
  data: ActivityData[];
  year: number;
  availableYears?: number[];
  onYearChange?: (year: number) => void;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  data,
  year,
  availableYears,
  onYearChange
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [scrollRatio, setScrollRatio] = useState(0);
  const [thumbRatio, setThumbRatio] = useState(1);
  const [isOverflow, setIsOverflow] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  const MONTHS = [
    t('common.jan', '一月'), t('common.feb', '二月'), t('common.mar', '三月'),
    t('common.apr', '四月'), t('common.may', '五月'), t('common.jun', '六月'),
    t('common.jul', '七月'), t('common.aug', '八月'), t('common.sep', '九月'),
    t('common.oct', '十月'), t('common.nov', '十一月'), t('common.dec', '十二月')
  ];

  const DAYS = [
    t('common.sun', '日'), t('common.mon', '一'), t('common.tue', '二'),
    t('common.wed', '三'), t('common.thu', '四'), t('common.fri', '五'),
    t('common.sat', '六')
  ];

  const gridMatrix = useMemo(() => generateHeatmapMatrix(data, year), [data, year]);

  const numCols = gridMatrix[0]?.length ?? 53;
  const getColorLevel = (count: number) => {
    if (count === 0) return styles.level0;
    return styles.level1;
  };

  const allYears = useMemo(() => {
    if (availableYears && availableYears.length > 0) return [...availableYears].sort((a, b) => a - b);
    if (data.length > 0) {
      const yearSet = new Set<number>();
      data.forEach(d => {
        const y = parseInt(d.date.substring(0, 4), 10);
        if (!isNaN(y)) yearSet.add(y);
      });
      return Array.from(yearSet).sort((a, b) => a - b);
    }
    const now = new Date().getFullYear();
    return [now];
  }, [data, availableYears]);

  const updateThumbPosition = useCallback((ratio: number) => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const width = Math.max(thumbRatio * 100, 10);
    const left = ratio * (100 - width);
    thumb.style.transform = `translateX(${left / width * 100}%)`;
  }, [thumbRatio]);

  const syncScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setIsOverflow(hasOverflow);
    if (hasOverflow) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const newThumbRatio = el.clientWidth / el.scrollWidth;
      setThumbRatio(newThumbRatio);
      const ratio = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
      setScrollRatio(ratio);
      updateThumbPosition(ratio);
    }
  }, [updateThumbPosition]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    syncScroll();

    const onScroll = () => {
      if (isDragging.current) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const ratio = maxScroll > 0 ? el.scrollLeft / maxScroll : 0;
      setScrollRatio(ratio);
      updateThumbPosition(ratio);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', syncScroll);

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', syncScroll);
    };
  }, [syncScroll, updateThumbPosition]);

  const handleDragStart = useCallback((clientX: number) => {
    isDragging.current = true;
    const thumb = thumbRef.current;
    if (thumb) thumb.style.transition = 'none';
    dragStartX.current = clientX;
    dragStartScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging.current) return;
    const el = scrollRef.current;
    const thumb = thumbRef.current;
    if (!el || !thumb) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const trackWidth = el.clientWidth;
    const thumbPixelWidth = trackWidth * thumbRatio;
    const movableRange = trackWidth - thumbPixelWidth;

    const deltaX = clientX - dragStartX.current;
    const scrollDelta = movableRange > 0 ? (deltaX / movableRange) * maxScroll : 0;
    const newScrollLeft = Math.max(0, Math.min(maxScroll, dragStartScrollLeft.current + scrollDelta));
    
    el.scrollLeft = newScrollLeft;
    
    const ratio = maxScroll > 0 ? newScrollLeft / maxScroll : 0;
    updateThumbPosition(ratio);
  }, [thumbRatio, updateThumbPosition]);

  const handleDragEnd = useCallback(() => {
    isDragging.current = false;
    const thumb = thumbRef.current;
    if (thumb) thumb.style.transition = '';
    
    const el = scrollRef.current;
    if (el) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setScrollRatio(maxScroll > 0 ? el.scrollLeft / maxScroll : 0);
    }
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX);
    const onEnd = () => handleDragEnd();

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onEnd);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.scrollTo({ left: (el.scrollWidth - el.clientWidth) * ratio, behavior: 'smooth' });
  };

  const handleYearChange = (selectedYear: number) => {
    onYearChange?.(selectedYear);
    setShowYearPicker(false);
  };

  const totalCount = data.reduce((a, b) => a + b.count, 0);
  const thumbWidth = Math.max(thumbRatio * 100, 10);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{year} {t('activity.yearly_records', '年度日记记录')}</h3>
        <div className={styles.selectors}>
          <button className={styles.yearBtn} onClick={() => setShowYearPicker(true)}>
            {year}年 ▾
          </button>
          <span className={styles.totalBadge}>{totalCount} {t('activity.interactions', '篇日记')}</span>
        </div>
      </div>

      {showYearPicker && (
        <div className={styles.yearOverlay} onClick={() => setShowYearPicker(false)}>
          <div className={styles.yearModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.yearModalTitle}>{t('activity.select_year', '选择年份')}</div>
            <div className={styles.yearGrid}>
              {allYears.map(y => (
                <button
                  key={y}
                  className={styles.yearOption}
                  data-active={y === year}
                  onClick={() => handleYearChange(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={styles.heatmapScroll} ref={scrollRef}>
        <div className={styles.heatmapContent} style={{ '--num-cols': numCols } as React.CSSProperties}>
          <div className={styles.yAxis}>
            {DAYS.map((day, i) => (
              <span key={day} className={styles.axisLabel} style={{ visibility: i % 2 === 0 ? 'visible' : 'hidden' }}>
                {day}
              </span>
            ))}
          </div>
          <div className={styles.graph}>
            <div className={styles.xAxis}>
              {MONTHS.map(m => <span key={m} className={styles.axisLabel}>{m}</span>)}
            </div>
            <div className={styles.cellsGrid}>
              {gridMatrix.map((row, rowIndex) => (
                <div key={rowIndex} className={styles.gridRow}>
                  {row.map((cell, colIndex) => (
                    <div
                      key={colIndex}
                      className={`${styles.cell} ${getColorLevel(cell.count)}`}
                      title={`${cell.date.toISOString().split('T')[0]} : ${cell.count} ${t('activity.interactions', '篇日记')}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isOverflow && (
        <div className={styles.sliderTrack} onClick={handleTrackClick}>
          <div
            ref={thumbRef}
            className={styles.sliderThumb}
            style={{ width: `${thumbWidth}%` }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          />
        </div>
      )}
    </div>
  );
};
