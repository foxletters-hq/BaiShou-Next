import React, { useState } from 'react'
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
  /** 嵌入分组卡片内：无独立外框，行底部分隔线 */
  embedded?: boolean
  /** 嵌入模式下是否为分组最后一项 */
  isLast?: boolean
  children: React.ReactNode
}

export const SettingsExpansionTile: React.FC<SettingsExpansionTileProps> = ({
  icon,
  title,
  subtitle,
  titleAddon,
  nested = false,
  embedded = false,
  isLast = false,
  children
}) => {
  const [open, setOpen] = useState(false)

  const showRowDivider = !embedded && (!isLast || open)
  const showContentDivider = embedded && !isLast && open

  return (
    <div
      className={`settings-expansion-tile ${nested ? 'settings-nested' : ''} ${embedded ? 'settings-expansion-tile-embedded' : ''} ${open ? 'settings-open' : ''}`}
    >
      <div
        className={`settings-expansion-summary ${showRowDivider ? 'settings-expansion-summary-divider' : ''}`}
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

      <div className={`settings-expansion-grid-wrapper ${open ? 'expanded' : ''}`}>
        <div className="settings-expansion-grid-item">
          <div
            className={`settings-expansion-content ${embedded ? 'settings-expansion-content-embedded' : ''} ${showContentDivider ? 'settings-expansion-content-divider' : ''}`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
