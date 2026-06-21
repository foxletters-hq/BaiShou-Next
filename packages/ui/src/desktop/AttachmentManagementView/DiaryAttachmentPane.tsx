import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Folder, Tag, ChevronDown, FolderMinus, Trash2, CheckSquare } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { DiaryAttachmentGrid } from './DiaryAttachmentGrid'

export interface DiaryAttachmentPaneProps {
  vm: AttachmentManagementViewModel
}

export const DiaryAttachmentPane: React.FC<DiaryAttachmentPaneProps> = ({ vm }) => {
  const {
    t,
    formatSize,
    diaryTotalSizeMB,
    diaryAttachments,
    diaryOrphanSizeMB,
    availableYears,
    diaryYear,
    setDiaryYear,
    isYearPickerOpen,
    setIsYearPickerOpen,
    isMonthPickerOpen,
    setIsMonthPickerOpen,
    monthRef,
    diaryMonth,
    setDiaryMonth,
    isOrphanPickerOpen,
    setIsOrphanPickerOpen,
    orphanRef,
    diaryOrphanOnly,
    setDiaryOrphanOnly,
    pagedDiaryAttachments,
    selectedDiaryPaths,
    isDeleting,
    handleDeleteDiarySelected,
    toggleSelectAllDiary
  } = vm

  return (
    <motion.div
      key="diary"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={styles.paneContent}
    >
      <div className={styles.overviewCardWrapper}>
        <div className={styles.overviewCard}>
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.diary_attachment_total_size', '日记附件空间')}
            </span>
            <span className={`${styles.statValue} ${styles.colorPrimary}`}>
              {formatSize(diaryTotalSizeMB)}
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.diary_attachment_total_count', '日记文件总数')}
            </span>
            <span className={`${styles.statValue} ${styles.colorOnSurface}`}>
              {diaryAttachments.length}
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.diary_attachment_orphans_size', '孤立残余体积')}
            </span>
            <span
              className={`${styles.statValue} ${diaryOrphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}
            >
              {formatSize(diaryOrphanSizeMB)}
            </span>
          </div>
        </div>
      </div>

      {/* 联合筛选工具栏 */}
      <div className={styles.toolbarWrapper}>
        <div className={styles.filtersGroup}>
          {/* 年份选择 (对标回忆画廊 Portal Modal) */}
          {availableYears.length > 0 ? (
            <div className={styles.filterFieldYear}>
              <button
                className={`${styles.yearSelectTrigger} ${isYearPickerOpen ? styles.open : ''}`}
                onClick={() => setIsYearPickerOpen(true)}
              >
                <Calendar size={14} className={styles.filterIcon} />
                <span>
                  {diaryYear === 'all'
                    ? t('gallery.filter_all_years', '全部年份')
                    : `${diaryYear}${t('common.year_suffix', '年')}`}
                </span>
                <ChevronDown size={14} className={styles.yearSelectChevron} />
              </button>
            </div>
          ) : (
            <div className={styles.filterField}>
              <Calendar size={14} className={styles.filterIcon} />
              <span className={styles.filterSelectEmpty}>
                {t('gallery.filter_all_years', '全部年份')}
              </span>
            </div>
          )}

          {/* 月份选择 (自定义 Portal/Dropdown picker 美化，去除 Windows 系统原生下拉框) */}
          <div className={styles.filterFieldDropdown} ref={monthRef}>
            <button
              className={`${styles.dropdownTrigger} ${isMonthPickerOpen ? styles.open : ''}`}
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
            >
              <Folder size={14} className={styles.filterIcon} />
              <span>
                {diaryMonth === 'all'
                  ? t('settings.all_months', '全部月份')
                  : `${diaryMonth}${t('common.month_suffix', '月')}`}
              </span>
              <ChevronDown size={14} className={styles.dropdownChevron} />
            </button>
            <AnimatePresence>
              {isMonthPickerOpen && (
                <motion.div
                  className={styles.dropdownMenu}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.dropdownList}>
                    <button
                      className={`${styles.dropdownItem} ${diaryMonth === 'all' ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryMonth('all')
                        setIsMonthPickerOpen(false)
                      }}
                    >
                      {t('settings.all_months', '全部月份')}
                    </button>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(
                      (m) => (
                        <button
                          key={m}
                          className={`${styles.dropdownItem} ${diaryMonth === m ? styles.active : ''}`}
                          onClick={() => {
                            setDiaryMonth(m)
                            setIsMonthPickerOpen(false)
                          }}
                        >
                          {m}
                          {t('common.month_suffix', '月')}
                        </button>
                      )
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 筛选过滤（全部筛选 / 孤立附件） */}
          <div className={styles.filterFieldDropdown} ref={orphanRef}>
            <button
              className={`${styles.dropdownTrigger} ${isOrphanPickerOpen ? styles.open : ''}`}
              onClick={() => setIsOrphanPickerOpen(!isOrphanPickerOpen)}
            >
              <Tag size={14} className={styles.filterIcon} />
              <span>
                {diaryOrphanOnly
                  ? t('settings.tag_orphan', '孤立附件')
                  : t('settings.all_filters', '全部筛选')}
              </span>
              <ChevronDown size={14} className={styles.dropdownChevron} />
            </button>
            <AnimatePresence>
              {isOrphanPickerOpen && (
                <motion.div
                  className={styles.dropdownMenu}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.dropdownList}>
                    <button
                      className={`${styles.dropdownItem} ${!diaryOrphanOnly ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryOrphanOnly(false)
                        setIsOrphanPickerOpen(false)
                      }}
                    >
                      {t('settings.all_filters', '全部筛选')}
                    </button>
                    <button
                      className={`${styles.dropdownItem} ${diaryOrphanOnly ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryOrphanOnly(true)
                        setIsOrphanPickerOpen(false)
                      }}
                    >
                      {t('settings.tag_orphan', '孤立附件')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className={styles.tabsRow}>
          {pagedDiaryAttachments.length > 0 && selectedDiaryPaths.size > 0 && (
            <button
              className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
              onClick={handleDeleteDiarySelected}
              disabled={isDeleting}
            >
              <Trash2 size={16} />
              {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                '$count',
                selectedDiaryPaths.size.toString()
              )}
            </button>
          )}

          {pagedDiaryAttachments.length > 0 && (
            <button
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={toggleSelectAllDiary}
            >
              <CheckSquare size={16} />
              {selectedDiaryPaths.size === pagedDiaryAttachments.length
                ? t('settings.attachment_deselect_all', '取消全选')
                : t('settings.attachment_select_all', '全选本页')}
            </button>
          )}
        </div>
      </div>

      <DiaryAttachmentGrid vm={vm} />
    </motion.div>
  )
}
