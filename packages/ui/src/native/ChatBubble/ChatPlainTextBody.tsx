import React, { useMemo } from 'react'
import { View, Text, StyleSheet, type TextStyle } from 'react-native'

function renderInlineBold(text: string, baseStyle: TextStyle, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Text key={`${keyPrefix}-b-${index}`} style={[baseStyle, styles.bold]}>
          {part.slice(2, -2)}
        </Text>
      )
    }
    return part
  })
}

export interface ChatPlainTextBodyProps {
  content: string
  color: string
}

/**
 * 聊天气泡正文：纯 RN Text 布局，避免 EnrichedMarkdownText 少报高度导致长消息被裁剪。
 * 支持段落与 **粗体**；复杂 Markdown 由上层回退到 Legacy 渲染器。
 */
export function ChatPlainTextBody({ content, color }: ChatPlainTextBodyProps) {
  const paragraphs = useMemo(() => content.replace(/\r\n/g, '\n').split(/\n\n+/), [content])
  const baseStyle = useMemo(() => [styles.text, { color }], [color])

  return (
    <View style={styles.root}>
      {paragraphs.map((paragraph, index) => {
        const lines = paragraph.split('\n')
        return (
          <Text
            key={`p-${index}`}
            style={[baseStyle, index > 0 ? styles.paragraphGap : null]}
            selectable
          >
            {lines.map((line, lineIndex) => (
              <React.Fragment key={`p-${index}-l-${lineIndex}`}>
                {lineIndex > 0 ? '\n' : null}
                {renderInlineBold(line, baseStyle[0], `p-${index}-l-${lineIndex}`)}
              </React.Fragment>
            ))}
          </Text>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    width: '100%'
  },
  text: {
    fontSize: 15,
    lineHeight: 24
  },
  bold: {
    fontWeight: '700'
  },
  paragraphGap: {
    marginTop: 8
  }
})
