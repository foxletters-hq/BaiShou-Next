import React from 'react'
import { useTranslation } from 'react-i18next'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown } from 'lucide-react'
import type { SummaryTab } from './gallery-panel.utils'
import { SUMMARY_TABS } from './gallery-panel.utils'

interface GalleryYearPickerModalProps {
  mounted: boolean
  isOpen: boolean
  selectedYear: string
  availableYears: string[]
  activeYearRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onYearChange: (year: string) => void
}

export const GalleryYearPickerModal: React.FC<GalleryYearPickerModalProps> = ({
  mounted,
  isOpen,
  selectedYear,
  availableYears,
  activeYearRef,
  onClose,
  onYearChange
}) => {
  const { t } = useTranslation()

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="gallery-year-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="gallery-year-modal-content"
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
            <div className="gallery-year-modal-header">
              <h3>{t('gallery.select_year', 'Select Year')}</h3>
              <button className="gallery-year-modal-close" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            <div className="gallery-year-modal-body">
              <div className="gallery-year-modal-sticky-header">
                <button
                  ref={selectedYear === 'all' ? activeYearRef : null}
                  className={`gallery-year-modal-all-btn ${selectedYear === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    onYearChange('all')
                    onClose()
                  }}
                >
                  {t('gallery.filter_all_years', '全部年份')}
                </button>
              </div>

              <div className="gallery-year-modal-grid">
                {availableYears.map((year) => {
                  const isSelected = selectedYear === year
                  return (
                    <button
                      key={year}
                      ref={isSelected ? activeYearRef : null}
                      className={`gallery-year-modal-grid-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        onYearChange(year)
                        onClose()
                      }}
                    >
                      {year}
                      {t('common.year_suffix', '')}
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

interface GalleryTabsHeaderProps {
  activeTab: SummaryTab
  selectedYear: string
  availableYears: string[]
  isYearPickerOpen: boolean
  onTabChange: (tab: SummaryTab) => void
  onOpenYearPicker: () => void
}

export const GalleryTabsHeader: React.FC<GalleryTabsHeaderProps> = ({
  activeTab,
  selectedYear,
  availableYears,
  isYearPickerOpen,
  onTabChange,
  onOpenYearPicker
}) => {
  const { t } = useTranslation()

  return (
    <div className="gallery-header-row">
      <div className="gallery-tabs-container">
        {SUMMARY_TABS.map((tab) => (
          <button
            key={tab}
            className={`gallery-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {t(`summary.tab_${tab}`, tab)}
          </button>
        ))}
      </div>

      {availableYears.length > 0 && (
        <div className="gallery-filter-container">
          <button
            className={`gallery-year-select-trigger ${isYearPickerOpen ? 'open' : ''}`}
            onClick={onOpenYearPicker}
          >
            <span>
              {selectedYear === 'all'
                ? t('gallery.filter_all_years', 'All Years')
                : `${selectedYear}${t('common.year_suffix', '')}`}
            </span>
            <ChevronDown size={16} className="gallery-select-chevron" />
          </button>
        </div>
      )}
    </div>
  )
}
