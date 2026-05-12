import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rows3 } from 'lucide-react';
import styles from './PageSizeSelector.module.css';

export interface PageSizeSelectorProps {
  value: number;
  options: number[];
  onChange: (size: number) => void;
  label?: string;
}

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  value,
  options,
  onChange,
  label = '条/页',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (size: number) => {
    onChange(size);
    setIsOpen(false);
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button className={styles.triggerBtn} onClick={() => setIsOpen(!isOpen)}>
        <span className={styles.pageSizeValue}>{value}</span>
        <span className={styles.pageSizeUnit}>{label}</span>
        <Rows3 size={14} className={styles.icon} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className={styles.dropdownOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              className={styles.dropdownContent}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96, transition: { duration: 0.12 } }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              <div className={styles.optionsGrid}>
                {options.map(size => (
                  <button
                    key={size}
                    className={`${styles.optionBtn} ${size === value ? styles.optionBtnSelected : ''}`}
                    onClick={() => handleSelect(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className={styles.divider} />
              <div className={styles.footer}>
                <span className={styles.footerText}>{label}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
