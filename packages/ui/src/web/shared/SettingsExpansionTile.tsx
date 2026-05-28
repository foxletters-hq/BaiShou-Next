import React, { useState, useEffect } from 'react'
import { MdExpandMore } from 'react-icons/md'
import { isSettingsInlineHelpTarget, settingsInlineHelpHostProps } from './settingsInlineHelpBlock'
import './SettingsListTile.css'

export interface SettingsExpansionTileProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  /** Shown beside the title (e.g. help icon). */
  titleAddon?: React.ReactNode
  nested?: boolean
  children: React.ReactNode
}

export const SettingsExpansionTile: React.FC<SettingsExpansionTileProps> = ({
  icon,
  title,
  subtitle,
  titleAddon,
  nested = false,
  children
}) => {
  const [open, setOpen] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (open) {
      setShouldRender(true)
    } else {
      timer = setTimeout(() => setShouldRender(false), 350) // Match CSS transition duration
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [open])

  return (
    <div
      className={`settings-expansion-tile ${nested ? 'settings-nested' : ''} ${open ? 'settings-open' : ''}`}
    >
      <div
        className="settings-expansion-summary"
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if (isSettingsInlineHelpTarget(e.target)) return
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          if (isSettingsInlineHelpTarget(e.target)) return
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        {icon && <div className="settings-list-tile-leading">{icon}</div>}
        <div className="settings-list-tile-content">
          <span className="settings-list-tile-title settings-list-tile-title-row">
            {title}
            {titleAddon ? <span {...settingsInlineHelpHostProps}>{titleAddon}</span> : null}
          </span>
          {subtitle && <span className="settings-list-tile-subtitle">{subtitle}</span>}
        </div>
        <MdExpandMore className="settings-expansion-arrow" size={24} />
      </div>

      {/* Uses modern CSS Grid transition for bidirectional smooth height animation + delayed unmount */}
      <div className={`settings-expansion-grid-wrapper ${open ? 'expanded' : ''}`}>
        <div className="settings-expansion-grid-item">
          {shouldRender && <div className="settings-expansion-content">{children}</div>}
        </div>
      </div>
    </div>
  )
}
