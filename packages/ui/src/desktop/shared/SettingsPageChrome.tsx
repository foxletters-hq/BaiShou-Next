import React from 'react'
import styles from './SettingsPageChrome.module.css'

export type SettingsPageChromeLayout = 'scroll' | 'stack'

export interface SettingsPageChromeProps {
  title: React.ReactNode
  children: React.ReactNode
  /** 紧挨标题右侧（如帮助 ?），不要放到顶栏最右 */
  titleAccessory?: React.ReactNode
  /** 顶栏最右侧操作区 */
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
  titleAccessory,
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
        <div className={styles.titleGroup}>
          <h2 className={styles.title}>{title}</h2>
          {titleAccessory ? <div className={styles.titleAccessory}>{titleAccessory}</div> : null}
        </div>
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
