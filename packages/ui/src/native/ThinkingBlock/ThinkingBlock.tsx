import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { CollapsibleAncillaryBlock } from '../CollapsibleAncillaryBlock'

const MAX_PREVIEW_LINES = 5
const PREVIEW_LINE_HEIGHT = 14

export interface ThinkingBlockProps {
  content: string
  isThinking?: boolean
  thinkingTimeMs?: number
  defaultOpen?: boolean
  autoCollapse?: boolean
  headerIcon?: string
  forceVisible?: boolean
  activeStatusLabel?: string
  completedStatusLabel?: string
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isThinking = false,
  thinkingTimeMs = 0,
  defaultOpen = false,
  autoCollapse = true,
  headerIcon = '✨',
  forceVisible = false,
  activeStatusLabel,
  completedStatusLabel
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const startTimeRef = useRef(Date.now())
  const [displayTime, setDisplayTime] = useState(thinkingTimeMs)

  useEffect(() => {
    if (isThinking) {
      startTimeRef.current = Date.now()
      setDisplayTime(0)
      const timer = setInterval(() => {
        setDisplayTime(Date.now() - startTimeRef.current)
      }, 100)
      return () => clearInterval(timer)
    }
    if (thinkingTimeMs > 0) {
      setDisplayTime(thinkingTimeMs)
    }
    return undefined
  }, [isThinking, thinkingTimeMs])

  useEffect(() => {
    if (autoCollapse && isThinking) {
      setIsOpen(false)
    }
  }, [autoCollapse, isThinking])

  const timeText = useMemo(() => {
    const seconds = displayTime / 1000
    if (seconds < 1) return `${Math.round(displayTime / 100) * 100}ms`
    return `${seconds.toFixed(1)}s`
  }, [displayTime])

  const statusText = useMemo(() => {
    if (isThinking) {
      if (activeStatusLabel) return `${activeStatusLabel} · ${timeText}`
      return t('agent.chat.thinking_time', '思考中 {{time}}', { time: timeText })
    }
    if (displayTime > 0) {
      if (completedStatusLabel) {
        return completedStatusLabel.includes('{{time}}')
          ? completedStatusLabel.replace('{{time}}', timeText)
          : `${completedStatusLabel} · ${timeText}`
      }
      return t('agent.chat.thought_time', '思考耗时 {{time}}', { time: timeText })
    }
    if (completedStatusLabel) return completedStatusLabel
    return t('agent.chat.thought_process', '思考过程')
  }, [isThinking, displayTime, timeText, t, activeStatusLabel, completedStatusLabel])

  const previewLines = useMemo(() => {
    if (!content) return []
    const lines = isThinking ? content.split('\n').slice(0, -1) : content.split('\n')
    return lines.filter((line) => line.trim() !== '')
  }, [content, isThinking])

  const previewHeight = useMemo(() => {
    const visibleCount = Math.min(previewLines.length, MAX_PREVIEW_LINES)
    if (visibleCount < 1) return 38
    return Math.min(120, Math.max(visibleCount + 1, 2) * PREVIEW_LINE_HEIGHT + 8)
  }, [previewLines.length])

  if (!content && !(forceVisible && isThinking)) return null

  const showCollapsedPreview = isThinking && !isOpen

  const preview = showCollapsedPreview ? (
    <View style={[styles.previewContainer, { height: previewHeight }]}>
      <View style={styles.previewScroll}>
        {previewLines.slice(-MAX_PREVIEW_LINES).map((line, index) => (
          <Text
            key={`${index}-${line.slice(0, 12)}`}
            style={[styles.previewLine, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {line}
          </Text>
        ))}
      </View>
      <View
        style={[styles.previewFade, { backgroundColor: colors.bgSurface }]}
        pointerEvents="none"
      />
    </View>
  ) : undefined

  return (
    <CollapsibleAncillaryBlock
      headerIcon={headerIcon}
      title={statusText}
      open={isOpen}
      onToggle={() => setIsOpen((prev) => !prev)}
      preview={preview}
    >
      <MarkdownRenderer content={content} variant="ancillary" />
    </CollapsibleAncillaryBlock>
  )
}

const styles = StyleSheet.create({
  previewContainer: {
    overflow: 'hidden',
    position: 'relative'
  },
  previewScroll: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 2
  },
  previewLine: {
    fontSize: 11,
    lineHeight: PREVIEW_LINE_HEIGHT
  },
  previewFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    opacity: 0.85
  }
})
