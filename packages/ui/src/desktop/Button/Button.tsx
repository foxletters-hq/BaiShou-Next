import React, { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
  variant?: 'elevated' | 'text' | 'outlined'
  size?: 'default' | 'small'
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'outlined',
  size = 'small',
  isLoading = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = [styles.button, styles[variant]]
  if (size === 'small') baseClasses.push(styles.small)
  if (isLoading) baseClasses.push(styles.loading)
  if (className) baseClasses.push(className)

  return (
    <button className={baseClasses.join(' ')} disabled={isLoading || props.disabled} {...props}>
      {isLoading ? <span className={styles.spinner}></span> : null}
      {children}
    </button>
  )
}
