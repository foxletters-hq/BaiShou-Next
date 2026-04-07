import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler for modal
    const handleClickOutside = (e: MouseEvent) => {
      // If clicking directly on the overlay backdrop
      if (overlayRef.current && e.target === overlayRef.current) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && selectedMonth) {
      setViewYear(selectedMonth.getFullYear());
    }
  }, [isOpen, selectedMonth]);

  const months = [1,2,3,4,5,6,7,8,9,10,11,12];
  const currentPhysicalYear = new Date().getFullYear();
  // 最早从2000年开始，最晚到今年之后加30年
  const startYear = 2000;
  const endYear = currentPhysicalYear + 30;
  const yearsBlock = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i).reverse();

  // Make sure to scroll to the active year when opening
  const yearListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen && yearListRef.current) {
      const activeEl = yearListRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center' });
      }
    }
  }, [isOpen, viewYear]);

  const handleSelectMonth = (m: number) => {
    onChange(new Date(viewYear, m - 1, 1));
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  const handleThisMonth = () => {
    const now = new Date();
    onChange(new Date(now.getFullYear(), now.getMonth(), 1));
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper}>
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

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              className={styles.modalOverlay}
              ref={overlayRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className={styles.modalContent}
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
            <div className={styles.twoPaneContainer}>
              {/* Left Pane: Years */}
              <div className={styles.yearPane} ref={yearListRef}>
                 {yearsBlock.map(y => {
                   const isActiveView = viewYear === y;
                   const isSelectedYear = selectedMonth?.getFullYear() === y;
                   return (
                     <button 
                       key={y} 
                       data-active={isActiveView}
                       className={`${styles.paneItem} ${isActiveView ? styles.paneItemActive : ''} ${isSelectedYear && !isActiveView ? styles.paneItemSelected : ''}`}
                       onClick={() => setViewYear(y)}
                     >
                       {y}
                     </button>
                   );
                 })}
              </div>

              {/* Right Pane: Months */}
              <div className={styles.monthPane}>
                 {months.map(m => {
                   const isSelected = selectedMonth?.getFullYear() === viewYear && selectedMonth?.getMonth() + 1 === m;
                   const isCurrentMonth = currentPhysicalYear === viewYear && (new Date().getMonth() + 1) === m;
                   return (
                     <button 
                       key={m} 
                       className={`${styles.monthBtn} ${isSelected ? styles.monthBtnSelected : ''} ${isCurrentMonth && !isSelected ? styles.monthBtnCurrent : ''}`}
                       onClick={() => handleSelectMonth(m)}
                     >
                       {m}月
                     </button>
                   );
                 })}
              </div>
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
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
