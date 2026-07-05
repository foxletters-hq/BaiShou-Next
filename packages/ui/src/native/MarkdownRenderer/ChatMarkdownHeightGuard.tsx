import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { estimateChatMarkdownMinHeight } from './streamdown-markdown.util'

export interface ChatMarkdownHeightGuardProps {
  markdown: string
  children: React.ReactNode
}

/**
 * EnrichedMarkdownText 在 Android 上常少报整段高度，父级按错误高度裁剪正文。
 * 用内容估算 minHeight，保证长消息完整可见。
 */
export const ChatMarkdownHeightGuard: React.FC<ChatMarkdownHeightGuardProps> = ({
  markdown,
  children
}) => {
  const minHeight = useMemo(() => estimateChatMarkdownMinHeight(markdown), [markdown])

  return <View style={[styles.root, minHeight > 0 ? { minHeight } : null]}>{children}</View>
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    width: '100%',
    overflow: 'visible'
  }
})
