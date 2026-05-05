import React, { useState, useRef, useEffect, useCallback } from 'react';
import './WeatherPicker.css';

export interface WeatherOption {
  value: string;
  label: string;
}

interface WeatherPickerProps {
  value: string;
  options: WeatherOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export const WeatherPicker: React.FC<WeatherPickerProps> = ({
  value,
  options,
  onChange,
  placeholder = '天气',
}) => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label || placeholder;

  const closeDropdown = useCallback(() => {
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  const handleToggle = useCallback(() => {
    if (open) {
      closeDropdown();
    } else {
      setOpen(true);
    }
  }, [open, closeDropdown]);

  const handleSelect = useCallback(
    (option: WeatherOption) => {
      onChange(option.value);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  const handleOptionClick = useCallback(
    (option: WeatherOption) => (e: React.MouseEvent) => {
      e.stopPropagation();
      handleSelect(option);
    },
    [handleSelect],
  );

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, closeDropdown]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div className="wp-container" ref={containerRef}>
      <button
        className={`wp-trigger${open ? ' wp-trigger-open' : ''}${value ? ' wp-trigger-selected' : ''}`}
        onClick={handleToggle}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="wp-trigger-label">{displayLabel}</span>
        <span className={`wp-chevron${open ? ' wp-chevron-open' : ''}`}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className={`wp-dropdown${closing ? ' wp-dropdown-closing' : ''}`}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                className={`wp-option${isSelected ? ' wp-option-selected' : ''}`}
                onClick={handleOptionClick(option)}
                type="button"
                role="option"
                aria-selected={isSelected}
              >
                <span className="wp-option-label">{option.label}</span>
                {isSelected && (
                  <span className="wp-check">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
