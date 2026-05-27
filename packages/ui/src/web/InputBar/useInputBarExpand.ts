import { useState, useRef, useEffect } from 'react'
import styles from './InputBar.module.css'

export function useInputBarExpand(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  text: string
) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const isResizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const expandedHeightRef = useRef(180)

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return
    const deltaY = startY.current - e.clientY
    const maxHeight = Math.max(180, window.innerHeight - 180)
    const allowedMax = Math.min(600, maxHeight)
    const newHeight = Math.max(140, Math.min(startHeight.current + deltaY, allowedMax))
    const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`) as HTMLElement
    if (cardEl) {
      cardEl.style.height = `${newHeight}px`
      expandedHeightRef.current = newHeight
    }
  }

  const handleMouseUp = () => {
    isResizing.current = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true
    startY.current = e.clientY
    const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`)
    if (cardEl) startHeight.current = cardEl.getBoundingClientRect().height
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    e.preventDefault()
  }

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const toggleExpand = () => {
    const cardEl = textareaRef.current?.closest(`.${styles.inputCard}`) as HTMLElement
    if (!cardEl) return
    const expanding = !isExpanded
    setIsAnimating(true)
    if (expanding) {
      const startH = cardEl.getBoundingClientRect().height
      cardEl.style.height = `${startH}px`
      cardEl.offsetHeight
      setIsExpanded(true)
      setTimeout(() => {
        const maxHeight = Math.max(180, window.innerHeight - 180)
        const safeHeight = Math.max(
          140,
          Math.min(expandedHeightRef.current, Math.min(600, maxHeight))
        )
        cardEl.style.height = `${safeHeight}px`
        expandedHeightRef.current = safeHeight
        if (textareaRef.current) textareaRef.current.style.height = '100%'
      }, 30)
      setTimeout(() => setIsAnimating(false), 700)
    } else {
      const currentHeight = cardEl.getBoundingClientRect().height
      expandedHeightRef.current = currentHeight
      setIsExpanded(false)
      cardEl.classList.remove(styles.inputCardExpanded)
      const parentEl = cardEl.parentElement
      parentEl?.classList.remove(styles.constrainedBoxExpanded)
      if (textareaRef.current) {
        textareaRef.current.classList.remove(styles.textareaExpanded)
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`
      }
      cardEl.style.height = ''
      const targetHeight = cardEl.getBoundingClientRect().height
      cardEl.classList.add(styles.inputCardExpanded)
      parentEl?.classList.add(styles.constrainedBoxExpanded)
      if (textareaRef.current) {
        textareaRef.current.classList.add(styles.textareaExpanded)
        textareaRef.current.style.height = '100%'
      }
      cardEl.style.height = `${currentHeight}px`
      cardEl.offsetHeight
      setTimeout(() => {
        cardEl.style.height = `${targetHeight}px`
      }, 30)
      setTimeout(() => {
        setIsAnimating(false)
        cardEl.style.height = ''
      }, 700)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      if (textareaRef.current) textareaRef.current.style.height = '100%'
      return
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`
    }
  }, [text, isExpanded, textareaRef])

  return { isExpanded, isAnimating, handleMouseDown, toggleExpand }
}
