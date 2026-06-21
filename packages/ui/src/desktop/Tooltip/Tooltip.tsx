import React, { HTMLAttributes, useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import styles from './Tooltip.module.css'

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  content: React.ReactNode
  /** Extra class names on the portaled tooltip panel (e.g. wider max-width). */
  tooltipClassName?: string
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = '',
  tooltipClassName = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [stylesState, setStylesState] = useState<React.CSSProperties>({
    position: 'fixed',
    opacity: 0,
    pointerEvents: 'none'
  })
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top')

  useEffect(() => {
    if (!isVisible || !containerRef.current || !tooltipRef.current) {
      return () => {}
    }

    const updatePosition = () => {
      const container = containerRef.current
      const tooltip = tooltipRef.current
      if (!container || !tooltip) return

      const containerRect = container.getBoundingClientRect()
      const tooltipWidth = tooltip.offsetWidth
      const tooltipHeight = tooltip.offsetHeight

      // 默认在上方
      let targetPlacement: 'top' | 'bottom' = 'top'
      let top = containerRect.top - tooltipHeight - 8
      let left = containerRect.left + containerRect.width / 2 - tooltipWidth / 2

      // 判断顶部是否超出视口
      if (top < 8) {
        targetPlacement = 'bottom'
        top = containerRect.bottom + 8
      }

      // 限制左右边界，防止超出屏幕
      const minLeft = 8
      const maxLeft = window.innerWidth - tooltipWidth - 8
      if (left < minLeft) {
        left = minLeft
      } else if (left > maxLeft) {
        left = maxLeft
      }

      // 计算箭头在 tooltip 中的水平偏移像素值，使其指向 container 的中心
      const arrowLeftOffset = containerRect.left + containerRect.width / 2 - left

      setPlacement(targetPlacement)
      setStylesState({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        opacity: 1,
        pointerEvents: 'none',
        // 传递自定义 CSS 变量以修正箭头位置
        // @ts-ignore
        '--arrow-left': `${arrowLeftOffset}px`
      })
    }

    // 初始化计算位置
    updatePosition()

    // 监听滚动与改变窗口大小事件，以便动态校准 Portal 位置
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isVisible])

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${className}`.trim()}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      {...props}
    >
      {children}
      {isVisible &&
        ReactDOM.createPortal(
          <div
            ref={tooltipRef}
            className={`${styles.tooltip} ${styles[placement]} ${tooltipClassName}`.trim()}
            style={stylesState}
          >
            {content}
          </div>,
          document.body
        )}
    </div>
  )
}
