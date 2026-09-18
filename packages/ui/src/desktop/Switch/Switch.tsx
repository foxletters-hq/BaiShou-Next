import React, { InputHTMLAttributes, MouseEventHandler } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'onClick'
> {
  labelOn?: string
  labelOff?: string
  /** 默认 sm（42×24）；md 为更大的 52×32 */
  size?: 'sm' | 'md'
  /** 点击绑在 label 上（内部 input 是 pointer-events: none），所以目标是 label 不是 input */
  onClick?: MouseEventHandler<HTMLLabelElement>
}

export const Switch: React.FC<SwitchProps> = ({
  labelOn,
  labelOff,
  size = 'sm',
  className = '',
  onClick,
  ...props
}) => {
  return (
    <label
      className={`${styles.root} ${size === 'md' ? styles.sizeMd : ''} ${className}`.trim()}
      onClick={onClick}
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
