import React, { useState } from 'react';
import styles from './DatetimePickerSheet.module.css';
import { useTranslation } from 'react-i18next';


interface DatetimePickerSheetProps {
  initialDate?: Date;
  onConfirm: (date: Date) => void;
  onClose: () => void;
}

export const DatetimePickerSheet: React.FC<DatetimePickerSheetProps> = ({ 
  initialDate = new Date(), 
  onConfirm, 
  onClose 
}) => {
  const { t } = useTranslation();
  // A simplistic mock for the wheel picker since Native wheel is complex to recreate in bare React CSS
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  const handleConfirm = () => {


    onConfirm(selectedDate);
    onClose();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.sheet}>
         <div className={styles.handleBar} />
         <div className={styles.header}>
            <button className={styles.cancelBtn} onClick={onClose}>{t('common.cancel', '取消')}</button>
            <h3>{t('common.select_time', '选择时间')}</h3>
            <button className={styles.confirmBtn} onClick={handleConfirm}>{t('common.confirm', '确定')}</button>
         </div>

         <div className={styles.fakePickerContainer}>
            {/* Visual mock of a scroll wheel picker for date and time */}
            <div className={styles.wheelColumn}>
               <div className={styles.wheelItem}>2024年</div>
               <div className={styles.wheelItemActive}>2025年</div>
               <div className={styles.wheelItem}>2026年</div>
            </div>
            <div className={styles.wheelColumn}>
               <div className={styles.wheelItem}>02月</div>
               <div className={styles.wheelItemActive}>03月</div>
               <div className={styles.wheelItem}>04月</div>
            </div>
            <div className={styles.wheelColumn}>
               <div className={styles.wheelItem}>28日</div>
               <div className={styles.wheelItemActive}>29日</div>
               <div className={styles.wheelItem}>30日</div>
            </div>
            
            <div className={styles.highlightBar} />
         </div>
      </div>
    </>
  );
};
