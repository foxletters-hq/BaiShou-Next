import React, { useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { splitStreamingRevealUnits } from '@baishou/shared'
import { useNativeTheme } from '../theme'

const LINE_ENTER_DURATION_MS = 320

export interface StreamingMarkdownLinesProps {
  content: string
  variant?: 'chat' | 'ancillary'
}

/** 流式正文：按视觉行分段渲染，新行柔和淡入，避免 Markdown 整段重绘。 */
export function StreamingMarkdownLines({
  content,
  variant = 'chat'
}: StreamingMarkdownLinesProps) {
  const { colors } = useNativeTheme()
  const isAncillary = variant === 'ancillary'
  const lines = useMemo(() => {
    const { completeUnits, partialUnit } = splitStreamingRevealUnits(content, 14)
    const rows = partialUnit ? [...completeUnits, partialUnit] : completeUnits
    return rows.map((line) => line.replace(/\n+$/g, '')).filter((line) => line.length > 0)
  }, [content])

  const prevLineCountRef = useRef(0)
  const lineCount = lines.length
  const animateFromIndex = prevLineCountRef.current
  if (lineCount > prevLineCountRef.current) {
    prevLineCountRef.current = lineCount
  }

  if (lines.length === 0) return null

  return (
    <View>
      {lines.map((line, index) => {
        const shouldAnimate = index >= animateFromIndex
        const isPartialLine = index === lines.length - 1 && !line.endsWith('\n')

        if (shouldAnimate) {
          return (
            <Animated.View
              key={`stream-line-${index}`}
              entering={FadeIn.duration(LINE_ENTER_DURATION_MS)}
            >
              <Animated.Text
                style={[
                  styles.line,
                  isAncillary ? styles.ancillaryLine : null,
                  isPartialLine ? styles.partialLine : null,
                  { color: isAncillary ? colors.textSecondary : colors.textPrimary }
                ]}
              >
                {line}
              </Animated.Text>
            </Animated.View>
          )
        }

        return (
          <View key={`stream-line-${index}`}>
            <Animated.Text
              style={[
                styles.line,
                isAncillary ? styles.ancillaryLine : null,
                isPartialLine ? styles.partialLine : null,
                { color: isAncillary ? colors.textSecondary : colors.textPrimary }
              ]}
            >
              {line}
            </Animated.Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  line: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 2
  },
  ancillaryLine: {
    fontSize: 14,
    lineHeight: 20
  },
  partialLine: {
    opacity: 0.92
  }
})
