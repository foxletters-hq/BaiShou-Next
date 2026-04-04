import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import styles from './YearMonthPicker.module.css';

export interface YearMonthPickerProps {
  selectedMonth: Date | null;
  onChange: (date: Date | null) => void;
  titlePlaceholder?: string;
}

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({ 
  selectedMonth, 
  onChange,
  titlePlaceholder
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  // 维护内部试图切换状态 (以“年”为单位)
  const currentInitial = selectedMonth || new Date();
  const [viewYear, setViewYear] = useState(currentInitial.getFullYear());
  const [viewMode, setViewMode] = useState<'months' | 'years'>('months');
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedMonth) {
      setViewYear(selectedMonth.getFullYear());
    }
  }, [isOpen, selectedMonth]);

  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  
  // Year mode context
  const startDecade = Math.floor(viewYear / 12) * 12;
  const yearsBlock = Array.from({ length: 12 }, (_, i) => startDecade + i);

  const handleSelectMonth = (m: number) => {
    onChange(new Date(viewYear, m - 1, 1));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
    setViewMode('months');
  };

  const handleThisMonth = () => {
    const now = new Date();
    onChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button className={styles.triggerBtn} onClick={() => setIsOpen(!isOpen)}>
        {!selectedMonth ? (
           <span className={styles.placeholderText}>{titlePlaceholder || t('common.all_dates', '全部日期')}</span>
        ) : (
           <div className={styles.flexBaseline}>
             <span className={styles.yearText}>{selectedMonth.getFullYear()}</span>
             <span className={styles.monthText}>{selectedMonth.getMonth() + 1}月</span>
           </div>
        )}
        <CalendarDays size={16} className={styles.icon} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className={styles.dropdownPicker}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header: Year or Decade navigation */}
            <div className={styles.header}>
               <button className={styles.navBtn} onClick={() => setViewYear(y => viewMode === 'years' ? y - 12 : y - 1)}>
                  <ChevronLeft size={18} />
               </button>
               <button 
                 className={styles.viewToggleBtn} 
                 onClick={() => setViewMode(v => v === 'months' ? 'years' : 'months')}
               >
                  {viewMode === 'months' ? `${viewYear} 年` : `${startDecade} - ${startDecade + 11}`}
               </button>
               <button className={styles.navBtn} onClick={() => setViewYear(y => viewMode === 'years' ? y + 12 : y + 1)}>
                  <ChevronRight size={18} />
               </button>
            </div>
            
            {/* Grid */}
            <div className={styles.monthGrid}>
               {viewMode === 'months' ? (
                 months.map(m => {
                   const isSelected = selectedMonth?.getFullYear() === viewYear && selectedMonth?.getMonth() + 1 === m;
                   return (
                     <button 
                       key={m} 
                       className={`${styles.monthBtn} ${isSelected ? styles.monthBtnSelected : ''}`}
                       onClick={() => handleSelectMonth(m)}
                     >
                       {m}月
                     </button>
                   );
                 })
               ) : (
                 yearsBlock.map(y => {
                   const isSelected = selectedMonth?.getFullYear() === y || viewYear === y;
                   return (
                     <button 
                       key={y} 
                       className={`${styles.monthBtn} ${isSelected ? styles.monthBtnSelected : ''}`}
                       onClick={() => { setViewYear(y); setViewMode('months'); }}
                     >
                       {y}
                     </button>
                   );
                 })
               )}
            </div>

            <div className={styles.divider} />

            {/* Quick Actions */}
            <div className={styles.footer}>
               <button className={styles.actionBtnSecondary} onClick={handleClear}>
                  {t('common.view_all', '查看全部')}
               </button>
               <button className={styles.actionBtnPrimary} onClick={handleThisMonth}>
                  {t('common.this_month', '跳转本月')}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
