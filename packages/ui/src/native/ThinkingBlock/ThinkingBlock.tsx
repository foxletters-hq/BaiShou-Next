import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { CollapsibleHeight } from '../CollapsibleHeight'

const DEFAULT_MAX_PREVIEW_LINES = 3
const PREVIEW_LINE_HEIGHT = 14
const PREVIEW_WRAP_CHARS = 32
const CHEVRON_MS = 250

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
  /** 折叠预览最多显示行数（流式思考建议 2） */
  maxPreviewLines?: number
  /** 为 true 时仅在 isThinking 期间展示（思考结束后整块隐藏） */
  streamingPreviewOnly?: boolean
}

/** 流式预览：保留进行中的末行（无换行时也能看到逐字输出） */
function buildStreamingPreviewLines(content: string, isThinking: boolean): string[] {
  if (!content) return []
  const lines = content.split('\n')
  if (!isThinking) {
    return lines.filter((line) => line.trim() !== '')
  }
  const completeLines =
    lines.length > 1 ? lines.slice(0, -1).filter((line) => line.trim() !== '') : []
  const inProgressLine = lines[lines.length - 1] ?? ''
  if (inProgressLine.trim() !== '') {
    completeLines.push(inProgressLine)
  }
  return completeLines
}

/** 无换行长段拆成多行，便于折叠区逐行滚动 */
function expandLongLinesForPreview(lines: string[], maxChars = PREVIEW_WRAP_CHARS): string[] {
  const result: string[] = []
  for (const line of lines) {
    if (line.length <= maxChars) {
      result.push(line)
      continue
    }
    for (let index = 0; index < line.length; index += maxChars) {
      result.push(line.slice(index, index + maxChars))
    }
  }
  return result
}

/** 对齐 desktop ThinkingBlock：折叠时高度与内容同步裁剪，而非先卸载内容再收高度 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isThinking = false,
  thinkingTimeMs = 0,
  defaultOpen = false,
  autoCollapse = true,
  headerIcon = '✨',
  forceVisible = false,
  activeStatusLabel,
  completedStatusLabel,
  maxPreviewLines = DEFAULT_MAX_PREVIEW_LINES,
  streamingPreviewOnly = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const startTimeRef = useRef(Date.now())
  const [displayTime, setDisplayTime] = useState(thinkingTimeMs)
  const chevronRotation = useSharedValue(defaultOpen ? 1 : 0)

  useEffect(() => {
    const target = isOpen ? 1 : 0
    chevronRotation.value = withTiming(target, {
      duration: CHEVRON_MS,
      easing: Easing.bezier(0.25, 0.8, 0.25, 1)
    })
  }, [isOpen, chevronRotation])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-90 + chevronRotation.value * 90}deg` }]
  }))

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
    const raw = buildStreamingPreviewLines(content, isThinking)
    return isThinking ? expandLongLinesForPreview(raw) : raw
  }, [content, isThinking])

  const visiblePreviewLines = useMemo(
    () => previewLines.slice(-maxPreviewLines),
    [previewLines, maxPreviewLines]
  )

  const previewHeight = Math.max(visiblePreviewLines.length, 1) * PREVIEW_LINE_HEIGHT
  const showTopFade = previewLines.length > maxPreviewLines

  if (streamingPreviewOnly && !isThinking) return null
  if (!content && !(forceVisible && isThinking)) return null

  const showCollapsedPreview = isThinking && !isOpen && visiblePreviewLines.length > 0
  const showExpandedBody = isOpen && (Boolean(content) || (forceVisible && isThinking))

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: colors.borderMuted,
          backgroundColor: colors.bgSurface
        }
      ]}
    >
      <TouchableOpacity
        style={[styles.header, { backgroundColor: colors.bgSurface }]}
        onPress={() => setIsOpen((prev) => !prev)}
        activeOpacity={0.7}
        delayPressIn={80}
      >
        <Text style={styles.headerIcon}>{headerIcon}</Text>
        <Text style={[styles.headerTitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {statusText}
        </Text>
        <Animated.View style={chevronStyle}>
          <MaterialIcons name="expand-more" size={18} color={colors.textTertiary} />
        </Animated.View>
      </TouchableOpacity>

      {showCollapsedPreview ? (
        <View style={[styles.previewBody, { borderTopColor: colors.borderSubtle }]}>
          <View style={[styles.previewContainer, { height: previewHeight }]}>
            <View style={styles.previewLinesColumn}>
              {visiblePreviewLines.map((line, index) => (
                <Text
                  key={`${index}-${line.slice(0, 16)}-${line.length}`}
                  style={[styles.previewLine, { color: colors.textTertiary }]}
                  numberOfLines={1}
                >
                  {line}
                </Text>
              ))}
            </View>
            {showTopFade ? (
              <View
                style={[styles.previewFade, { backgroundColor: colors.bgSurface }]}
                pointerEvents="none"
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {showExpandedBody ? (
        <CollapsibleHeight expanded animation="ease" durationMs={300}>
          <View style={[styles.body, { borderTopColor: colors.borderSubtle }]}>
            <MarkdownRenderer content={content} variant="ancillary" />
          </View>
        </CollapsibleHeight>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 42
  },
  headerIcon: {
    fontSize: 14,
    width: 24,
    textAlign: 'center',
    marginRight: 8,
    lineHeight: 16
  },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19
  },
  previewBody: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  previewContainer: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%'
  },
  previewLinesColumn: {
    justifyContent: 'flex-start'
  },
  previewLine: {
    fontSize: 11,
    lineHeight: PREVIEW_LINE_HEIGHT,
    opacity: 0.68
  },
  previewFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    opacity: 0.38
  }
})
