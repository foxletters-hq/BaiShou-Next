import React, { InputHTMLAttributes } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  labelOn?: string
  labelOff?: string
  /** 默认 md（52×32）；sm 更紧凑，适合设置页标题行等 */
  size?: 'sm' | 'md'
}

export const Switch: React.FC<SwitchProps> = ({
  labelOn,
  labelOff,
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <label
      className={`${styles.root} ${size === 'sm' ? styles.sizeSm : ''} ${className}`.trim()}
    >
      <input type="checkbox" className={styles.input} {...props} />
      <div className={styles.track}>
        <div className={styles.thumb}>
          {labelOn && <span className={styles.labelOn}>{labelOn}</span>}
          {labelOff && <span className={styles.labelOff}>{labelOff}</span>}
        </div>
      </div>
    </label>
  )
}
