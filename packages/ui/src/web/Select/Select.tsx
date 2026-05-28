import React, { useState, useRef, useEffect, SelectHTMLAttributes } from 'react'
import styles from './Select.module.css'

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
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (disabled) return
    setIsOpen(!isOpen)
  }

  const handleSelect = (val: string) => {
    if (disabled) return
    if (onChange && val !== value) {
      const mockEvent = {
        target: {
          name: props.name,
          value: val
        }
      } as React.ChangeEvent<HTMLSelectElement>
      onChange(mockEvent)
    }
    setIsOpen(false)
  }

  return (
    <div
      className={`${styles.container} ${className} ${disabled ? styles.disabled : ''} ${size === 'small' ? styles.sizeSmall : ''}`.trim()}
      ref={containerRef}
    >
      <div className={styles.wrapper}>
        <div
          className={`${styles.trigger} ${isOpen ? styles.isOpen : ''} ${error ? styles.hasError : ''}`}
          onClick={handleToggle}
          role="button"
          tabIndex={disabled ? -1 : 0}
        >
          <span className={styles.valueText}>
            {selectedOption ? selectedOption.label : placeholder || ''}
          </span>
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

        {isOpen && (
          <div className={styles.dropdown}>
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
        )}
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  )
}
