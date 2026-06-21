import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Rows3 } from 'lucide-react'
import styles from './PageSizeSelector.module.css'

export interface PageSizeSelectorProps {
  value: number
  options: number[]
  onChange: (size: number) => void
  label?: string
}

type DropdownPlacement = 'top' | 'bottom'

export const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  value,
  options,
  onChange,
  label
}) => {
  const { t } = useTranslation()
  const resolvedLabel = label ?? t('common.per_page_suffix', '/ page')
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [placement, setPlacement] = useState<DropdownPlacement>('top')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const dropdown = dropdownRef.current
    if (!trigger || !dropdown) return

    const triggerRect = trigger.getBoundingClientRect()
    const dropdownWidth = dropdown.offsetWidth
    const dropdownHeight = dropdown.offsetHeight
    const gap = 6

    let nextPlacement: DropdownPlacement = 'top'
    let top = triggerRect.top - dropdownHeight - gap

    if (top < 8) {
      nextPlacement = 'bottom'
      top = triggerRect.bottom + gap
    }

    let left = triggerRect.left + triggerRect.width / 2 - dropdownWidth / 2
    const minLeft = 8
    const maxLeft = window.innerWidth - dropdownWidth - 8
    left = Math.min(maxLeft, Math.max(minLeft, left))

    setPlacement(nextPlacement)
    setDropdownStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return undefined

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (size: number) => {
    onChange(size)
    setIsOpen(false)
  }

  const dropdownMotion = placement === 'top' ? { y: 8 } : { y: -8 }

  return (
    <div className={styles.wrapper}>
      <button
        ref={triggerRef}
        className={styles.triggerBtn}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.pageSizeValue}>{value}</span>
        <span className={styles.pageSizeUnit}>{resolvedLabel}</span>
        <Rows3 size={14} className={styles.icon} />
      </button>

      {mounted &&
        createPortal(
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
                  ref={dropdownRef}
                  className={styles.dropdownContent}
                  style={dropdownStyle}
                  initial={{ opacity: 0, ...dropdownMotion, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    ...dropdownMotion,
                    scale: 0.96,
                    transition: { duration: 0.12 }
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  onAnimationComplete={updatePosition}
                >
                  <div className={styles.optionsGrid}>
                    {options.map((size) => (
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
                    <span className={styles.footerText}>{resolvedLabel}</span>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
