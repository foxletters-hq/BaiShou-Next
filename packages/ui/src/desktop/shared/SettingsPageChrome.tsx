import React from 'react'
import styles from './SettingsPageChrome.module.css'

export type SettingsPageChromeLayout = 'scroll' | 'stack'

export interface SettingsPageChromeProps {
  title: React.ReactNode
  children: React.ReactNode
  trailing?: React.ReactNode
  className?: string
  /** scroll: absolute header + padded scroll area (default). stack: flex header + body for nested layouts. */
  layout?: SettingsPageChromeLayout
  scrollClassName?: string
  bodyClassName?: string
}

export const SettingsPageChrome: React.FC<SettingsPageChromeProps> = ({
  title,
  children,
  trailing,
  className,
  layout = 'scroll',
  scrollClassName,
  bodyClassName
}) => {
  const headerClass = layout === 'stack' ? styles.headerRowStacked : styles.headerRow

  return (
    <div className={`${styles.page}${className ? ` ${className}` : ''}`}>
      <div className={headerClass}>
        <h2 className={styles.title}>{title}</h2>
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      {layout === 'stack' ? (
        <div className={`${styles.body}${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
      ) : (
        <div className={`${styles.scrollArea}${scrollClassName ? ` ${scrollClassName}` : ''}`}>
          {children}
        </div>
      )}
    </div>
  )
}
