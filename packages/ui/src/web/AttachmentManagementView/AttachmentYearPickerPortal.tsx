import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'

export interface AttachmentYearPickerPortalProps {
  vm: AttachmentManagementViewModel
}

export const AttachmentYearPickerPortal: React.FC<AttachmentYearPickerPortalProps> = ({ vm }) => {
  const {
    t,
    mounted,
    isYearPickerOpen,
    setIsYearPickerOpen,
    diaryYear,
    setDiaryYear,
    availableYears,
    activeYearRef
  } = vm

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isYearPickerOpen && (
        <motion.div
          className={styles.yearModalOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsYearPickerOpen(false)}
        >
          <motion.div
            className={styles.yearModalContent}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.96,
              transition: { duration: 0.15 }
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.yearModalHeader}>
              <h3>{t('gallery.select_year', '选择年份')}</h3>
              <button className={styles.yearModalClose} onClick={() => setIsYearPickerOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.yearModalBody}>
              {/* 全部年份 粘性置顶容器 */}
              <div className={styles.yearModalStickyHeader}>
                <button
                  ref={diaryYear === 'all' ? activeYearRef : null}
                  className={`${styles.yearModalAllBtn} ${
                    diaryYear === 'all' ? styles.active : ''
                  }`}
                  onClick={() => {
                    setDiaryYear('all')
                    setIsYearPickerOpen(false)
                  }}
                >
                  {t('gallery.filter_all_years', '全部年份')}
                </button>
              </div>

              {/* 年份网格 */}
              <div className={styles.yearModalGrid}>
                {availableYears.map((year) => {
                  const isSelected = diaryYear === year
                  return (
                    <button
                      key={year}
                      ref={isSelected ? activeYearRef : null}
                      className={`${styles.yearModalGridItem} ${isSelected ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryYear(year)
                        setIsYearPickerOpen(false)
                      }}
                    >
                      {year}
                      {t('common.year_suffix', '年')}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
