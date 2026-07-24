import React, { useLayoutEffect, useRef, useState } from 'react'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: React.ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string = string> {
  value: T
  options: ReadonlyArray<SegmentedControlOption<NoInfer<T>>>
  onChange: (value: NoInfer<T>) => void
  stretch?: boolean
  inline?: boolean
  spaced?: boolean
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

interface ThumbRect {
  left: number
  width: number
}

/**
 * 分段滑块：白底指示器在选项间平滑滑动（与回忆「生成模式」同尺寸）。
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  stretch = false,
  inline = false,
  spaced = false,
  disabled = false,
  className,
  'aria-label': ariaLabel
}: SegmentedControlProps<T>): React.ReactElement {
  const groupRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef(new Map<T, HTMLButtonElement>())
  const valueRef = useRef(value)
  valueRef.current = value

  const [thumb, setThumb] = useState<ThumbRect | null>(null)
  const [animate, setAnimate] = useState(false)

  // 仅用 value 列表稳定依赖，避免父组件每次 render 新建 options 数组打断过渡
  const optionsKey = options.map((option) => option.value).join('\0')

  const measure = () => {
    const btn = btnRefs.current.get(valueRef.current)
    if (!btn) return
    const next = { left: btn.offsetLeft, width: btn.offsetWidth }
    setThumb((prev) => {
      if (prev && prev.left === next.left && prev.width === next.width) return prev
      return next
    })
  }

  useLayoutEffect(() => {
    measure()
    // 首帧定位后再开过渡，避免挂载时从 0 滑入
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [value, optionsKey])

  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => measure())
    observer.observe(group)
    for (const btn of btnRefs.current.values()) {
      observer.observe(btn)
    }
    return () => observer.disconnect()
  }, [optionsKey])

  const groupClass = [
    styles.group,
    stretch ? styles.groupStretch : '',
    inline ? styles.groupInline : '',
    spaced ? styles.groupSpaced : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={groupRef} className={groupClass} role="group" aria-label={ariaLabel}>
      {thumb ? (
        <span
          className={`${styles.thumb}${animate ? ` ${styles.thumbAnimate}` : ''}`}
          style={{
            width: thumb.width,
            transform: `translateX(${thumb.left}px)`
          }}
          aria-hidden
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            ref={(node) => {
              if (node) btnRefs.current.set(option.value, node)
              else btnRefs.current.delete(option.value)
            }}
            disabled={disabled || option.disabled}
            aria-pressed={active}
            className={`${styles.btn}${active ? ` ${styles.btnActive}` : ''}`}
            onClick={() => {
              if (option.value !== value) onChange(option.value)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
