import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type SelectHTMLAttributes,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import { withAppContentOverlay } from '../overlay'
import styles from './Select.module.css'
import {
  estimateSelectDropdownHeight,
  resolveSelectDropdownBox
} from './select-dropdown-placement.util'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'onChange' | 'size'
> {
  options: SelectOption[]
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  error?: string
  placeholder?: string
  size?: 'medium' | 'small'
  /** 默认表单样式；ghost 为轻量文字触发（工作台元信息条） */
  variant?: 'default' | 'ghost'
  leading?: ReactNode
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  error,
  className = '',
  disabled,
  placeholder,
  size = 'medium',
  variant = 'default',
  leading,
  id,
  name,
  'aria-label': ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)
  const displayLabel = selectedOption?.label || placeholder || ''

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    const dropdown = dropdownRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const measured = dropdown?.offsetHeight || estimateSelectDropdownHeight(options.length)
    const box = resolveSelectDropdownBox(
      { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      measured,
      { width: window.innerWidth, height: window.innerHeight },
      { minWidth: variant === 'ghost' ? 200 : rect.width }
    )
    setDropdownStyle({
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      maxHeight: `${box.maxHeight}px`
    })
  }, [options.length, variant])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
    const frame = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(frame)
  }, [isOpen, updatePosition, options.length])

  useEffect(() => {
    if (!isOpen) return undefined
    const dropdown = dropdownRef.current
    const observer =
      dropdown && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updatePosition())
        : null
    observer?.observe(dropdown)

    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, updatePosition])

  const handleToggle = () => {
    if (disabled) return
    setIsOpen((open) => !open)
  }

  const handleSelect = (val: string) => {
    if (disabled) return
    if (onChange && val !== value) {
      const mockEvent = {
        target: {
          name,
          value: val
        }
      } as React.ChangeEvent<HTMLSelectElement>
      onChange(mockEvent)
    }
    setIsOpen(false)
  }

  return (
    <div
      className={`${styles.container} ${className} ${disabled ? styles.disabled : ''} ${size === 'small' ? styles.sizeSmall : ''} ${variant === 'ghost' ? styles.variantGhost : ''}`.trim()}
      ref={containerRef}
    >
      <div className={styles.wrapper}>
        <div
          ref={triggerRef}
          id={id}
          className={`${styles.trigger} ${isOpen ? styles.isOpen : ''} ${error ? styles.hasError : ''}`}
          onClick={handleToggle}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleToggle()
            }
          }}
        >
          {leading ? <span className={styles.leading}>{leading}</span> : null}
          <span className={styles.valueText}>{displayLabel}</span>
          <div className={`${styles.icon} ${isOpen ? styles.rotated : ''}`}>
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {isOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <>
              <div
                className={withAppContentOverlay(styles.overlay)}
                onClick={() => setIsOpen(false)}
              />
              <div
                ref={dropdownRef}
                className={`${styles.dropdown} ${size === 'small' ? styles.sizeSmall : ''}`}
                style={dropdownStyle}
                role="listbox"
              >
                <ul className={styles.optionsList}>
                  {options.map((opt) => {
                    const isSelected = opt.value === value
                    return (
                      <li
                        key={opt.value}
                        className={`${styles.optionItem} ${isSelected ? styles.selected : ''}`}
                        onClick={() => handleSelect(opt.value)}
                        role="option"
                        aria-selected={isSelected}
                      >
                        {opt.label}
                        {isSelected && (
                          <span className={styles.checkIcon}>
                            <svg
                              width="12"
                              height="9"
                              viewBox="0 0 12 9"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M1 4.5L4.33333 7.5L11 1.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </>,
            document.body
          )}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  )
}
