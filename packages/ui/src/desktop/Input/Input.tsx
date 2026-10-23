import React, { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import styles from './Input.module.css'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  fieldSize?: 'default' | 'small'
  leading?: ReactNode
  trailing?: ReactNode
  /** 追加到原生 input 上，容器仍用 className */
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    fieldSize = 'default',
    leading,
    trailing,
    className = '',
    inputClassName = '',
    id,
    ...props
  },
  ref
) {
  const fieldClass = [
    'baishou-form-field',
    fieldSize === 'small' ? 'baishou-form-field--small' : '',
    error ? 'baishou-form-field--error' : '',
    leading ? 'baishou-form-field--pad-leading' : '',
    trailing ? 'baishou-form-field--with-trailing' : '',
    inputClassName
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={`${styles.container} ${className}`.trim()}>
      {label ? (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className={styles.inputWrapper}>
        <input id={id} ref={ref} className={fieldClass} {...props} />
        {leading ? <div className={styles.leading}>{leading}</div> : null}
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>
      {error ? <span className={styles.errorText}>{error}</span> : null}
    </div>
  )
})
