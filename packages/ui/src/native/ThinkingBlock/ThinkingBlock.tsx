import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer'

export interface ThinkingBlockProps {
  content: string
  isThinking?: boolean
  thinkingTimeMs?: number
  defaultOpen?: boolean
  autoCollapse?: boolean
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isThinking = false,
  thinkingTimeMs,
  defaultOpen = false,
  autoCollapse = false
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [expanded, setExpanded] = useState(autoCollapse ? false : defaultOpen)

  const toggleExpand = () => {
    setExpanded((prev) => !prev)
  }

  const getStatusText = (): string => {
    if (isThinking) {
      return t('agent.chat.thinking_time', '思考中 {{time}}', { time: '...' }).replace(' {{time}}', '...')
    }
    if (thinkingTimeMs !== undefined) {
      const seconds = (thinkingTimeMs / 1000).toFixed(1)
      return t('agent.chat.thought_time', '思考耗时 {{time}}', {
        time: `${seconds}s`
      })
    }
    return t('agent.chat.thought_process', '思考过程')
  }

  const getLastLines = (text: string, lines: number): string => {
    const allLines = text.split('\n')
    return allLines.slice(-lines).join('\n')
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurfaceHighest,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Text style={styles.icon}>✨</Text>
          <Text style={[styles.headerText, { color: colors.textSecondary }]}>
            {getStatusText()}
          </Text>
        </View>
        <Text
          style={[
            styles.arrow,
            {
              color: colors.textTertiary,
              transform: [{ rotate: expanded ? '90deg' : '0deg' }]
            }
          ]}
        >
          ▶
        </Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.content}>
          <MarkdownRenderer content={content} />
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <Text style={[styles.previewText, { color: colors.textTertiary }]} numberOfLines={3}>
            {getLastLines(content, 3)}
          </Text>
          <View
            style={[
              styles.gradientFade,
              {
                backgroundColor: colors.bgSurfaceHighest
              }
            ]}
            pointerEvents="none"
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  icon: {
    fontSize: 16,
    marginRight: 8
  },
  headerText: {
    fontSize: 14,
    fontWeight: '500'
  },
  arrow: {
    fontSize: 12
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 12
  },
  previewContainer: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingBottom: 8
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    maxHeight: 60
  },
  gradientFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    opacity: 0.7
  }
})
