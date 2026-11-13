import { useEffect, useRef, useState, type FC } from 'react';
import { LOCALE_OPTIONS } from '../i18n';
import { useApp } from '../context/AppContext';

export const LanguageSwitcher: FC = () => {
  const { locale, dict, switchLocale } = useApp();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const currentOption =
    LOCALE_OPTIONS.find((opt) => opt.code === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={['lang-switcher', open && 'is-open'].filter(Boolean).join(' ')}
      data-lang-switcher
    >
      <button
        type="button"
        className="lang-trigger"
        data-lang-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={dict.a11y.langSelect}
        data-i18n-aria-label="a11y.langSelect"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="lang-trigger-text" data-lang-current>
          {currentOption.shortLabel}
        </span>
      </button>
      <ul className="lang-menu" role="listbox" hidden={!open}>
        {LOCALE_OPTIONS.map((option) => {
          const isActive = option.code === locale;
          return (
            <li key={option.code} role="presentation">
              <button
                type="button"
                className={['lang-option', isActive && 'is-active']
                  .filter(Boolean)
                  .join(' ')}
                role="option"
                data-lang-option={option.code}
                aria-label={option.label}
                aria-selected={isActive}
                onClick={() => {
                  switchLocale(option.code);
                  setOpen(false);
                }}
              >
                {option.shortLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LanguageSwitcher;
