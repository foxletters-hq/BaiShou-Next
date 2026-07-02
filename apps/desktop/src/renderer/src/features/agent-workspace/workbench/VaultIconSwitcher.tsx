import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVaultSwitcher } from '../hooks/useVaultSwitcher'
import styles from './VaultIconSwitcher.module.css'

function vaultInitial(name: string | undefined): string {
  if (!name?.trim()) return '?'
  return name.trim().charAt(0).toUpperCase()
}

export const VaultIconSwitcher: React.FC = () => {
  const { t } = useTranslation()
  const { vaults, activeVault, isSwitchingVault, fetchVaults, preloadVault, handleSwitchVault } =
    useVaultSwitcher()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const timerId = window.setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true)
    }, 0)
    return () => {
      clearTimeout(timerId)
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [open])

  const toggle = () => {
    if (isSwitchingVault) return
    setOpen((prev) => {
      const next = !prev
      if (next && vaults.length === 0) void fetchVaults()
      return next
    })
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.iconBtn}
        onClick={toggle}
        disabled={isSwitchingVault}
        title={activeVault?.name || t('workspace.no_active', '未选择工作空间')}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className={styles.initial} aria-hidden>
          {vaultInitial(activeVault?.name)}
        </span>
      </button>
      {open ? (
        <div className={styles.popover} role="menu">
          {vaults.length > 0 ? (
            vaults.map((vault) => (
              <button
                key={vault.name}
                type="button"
                role="menuitem"
                className={`${styles.menuItem} ${
                  vault.name === activeVault?.name ? styles.menuItemActive : ''
                }`}
                onMouseEnter={() => preloadVault(vault.name)}
                onClick={() => {
                  setOpen(false)
                  void handleSwitchVault(vault.name)
                }}
              >
                <span className={styles.menuInitial}>{vaultInitial(vault.name)}</span>
                <span className={styles.menuName}>{vault.name}</span>
              </button>
            ))
          ) : (
            <div className={styles.placeholder}>{t('common.loading', '加载中…')}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
