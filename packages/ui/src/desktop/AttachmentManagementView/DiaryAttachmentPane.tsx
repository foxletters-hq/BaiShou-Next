import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Folder, Tag, ChevronDown, Trash2, CheckSquare } from 'lucide-react'
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
    openFilterPicker,
    toggleFilterPicker,
    setOpenFilterPicker,
    yearRef,
    monthRef,
    orphanRef,
    diaryMonth,
    setDiaryMonth,
    diaryOrphanOnly,
    setDiaryOrphanOnly,
    pagedDiaryAttachments,
    selectedDiaryPaths,
    isDeleting,
    handleDeleteDiarySelected,
    toggleSelectAllDiary
  } = vm

  const monthOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
    []
  )

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

      <div className={styles.toolbarWrapper}>
        <div className={styles.filtersGroup}>
          {availableYears.length > 0 ? (
            <div className={styles.filterFieldDropdown} ref={yearRef}>
              <button
                type="button"
                className={`${styles.dropdownTrigger} ${openFilterPicker === 'year' ? styles.open : ''}`}
                onClick={() => toggleFilterPicker('year')}
              >
                <Calendar size={14} className={styles.filterIcon} />
                <span>
                  {diaryYear === 'all'
                    ? t('gallery.filter_all_years', '全部年份')
                    : `${diaryYear}${t('common.year_suffix', '年')}`}
                </span>
                <ChevronDown size={14} className={styles.dropdownChevron} />
              </button>
              <AnimatePresence>
                {openFilterPicker === 'year' && (
                  <motion.div
                    className={`${styles.dropdownMenu} ${styles.dropdownMenuYear}`}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className={styles.dropdownList}>
                      <button
                        type="button"
                        className={`${styles.dropdownItem} ${diaryYear === 'all' ? styles.active : ''}`}
                        onClick={() => {
                          setDiaryYear('all')
                          setOpenFilterPicker(null)
                        }}
                      >
                        {t('gallery.filter_all_years', '全部年份')}
                      </button>
                      {availableYears.map((year) => (
                        <button
                          type="button"
                          key={year}
                          className={`${styles.dropdownItem} ${diaryYear === year ? styles.active : ''}`}
                          onClick={() => {
                            setDiaryYear(year)
                            setOpenFilterPicker(null)
                          }}
                        >
                          {year}
                          {t('common.year_suffix', '年')}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className={styles.filterField}>
              <Calendar size={14} className={styles.filterIcon} />
              <span className={styles.filterSelectEmpty}>
                {t('gallery.filter_all_years', '全部年份')}
              </span>
            </div>
          )}

          <div className={styles.filterFieldDropdown} ref={monthRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${openFilterPicker === 'month' ? styles.open : ''}`}
              onClick={() => toggleFilterPicker('month')}
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
              {openFilterPicker === 'month' && (
                <motion.div
                  className={styles.dropdownMenu}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.dropdownList}>
                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${diaryMonth === 'all' ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryMonth('all')
                        setOpenFilterPicker(null)
                      }}
                    >
                      {t('settings.all_months', '全部月份')}
                    </button>
                    {monthOptions.map((m) => (
                      <button
                        type="button"
                        key={m}
                        className={`${styles.dropdownItem} ${diaryMonth === m ? styles.active : ''}`}
                        onClick={() => {
                          setDiaryMonth(m)
                          setOpenFilterPicker(null)
                        }}
                      >
                        {m}
                        {t('common.month_suffix', '月')}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.filterFieldDropdown} ref={orphanRef}>
            <button
              type="button"
              className={`${styles.dropdownTrigger} ${openFilterPicker === 'orphan' ? styles.open : ''}`}
              onClick={() => toggleFilterPicker('orphan')}
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
              {openFilterPicker === 'orphan' && (
                <motion.div
                  className={styles.dropdownMenu}
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={styles.dropdownList}>
                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${!diaryOrphanOnly ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryOrphanOnly(false)
                        setOpenFilterPicker(null)
                      }}
                    >
                      {t('settings.all_filters', '全部筛选')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.dropdownItem} ${diaryOrphanOnly ? styles.active : ''}`}
                      onClick={() => {
                        setDiaryOrphanOnly(true)
                        setOpenFilterPicker(null)
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
              type="button"
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
              type="button"
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={toggleSelectAllDiary}
            >
              <CheckSquare size={16} />
              {selectedDiaryPaths.size === pagedDiaryAttachments.length
                ? t('settings.attachment_deselect_all', '取消全选')
                : t('settings.attachment_select_all_page', '全选本页')}
            </button>
          )}
        </div>
      </div>

      <DiaryAttachmentGrid vm={vm} />
    </motion.div>
  )
}
