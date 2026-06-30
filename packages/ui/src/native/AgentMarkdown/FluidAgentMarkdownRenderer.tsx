import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useNativeTheme } from '../theme'
import {
  MarkdownRenderer,
  type MarkdownRendererProps,
  type MarkdownRendererVariant
} from '../MarkdownRenderer/MarkdownRenderer'
import { splitStreamingMarkdownBlocks } from './fluid-markdown-blocks'
import { FluidTypingText, fluidTypingTextStyles } from './FluidTypingText'

const PRINT_CHUNK_SIZE = 4
const PRINT_INTERVAL_MS = 28
const CATCH_UP_THRESHOLD = 48

export interface FluidAgentMarkdownRendererProps {
  content: string
  variant?: MarkdownRendererVariant
  isStreaming?: boolean
  style?: MarkdownRendererProps['style']
  resolveImageUri?: MarkdownRendererProps['resolveImageUri']
  loadImageUri?: MarkdownRendererProps['loadImageUri']
  onImagePress?: MarkdownRendererProps['onImagePress']
}

export const FluidAgentMarkdownRenderer = React.memo(function FluidAgentMarkdownRenderer({
  content,
  variant = 'chat',
  isStreaming = true,
  style,
  resolveImageUri,
  loadImageUri,
  onImagePress
}: FluidAgentMarkdownRendererProps) {
  const { colors } = useNativeTheme()
  const isAncillary = variant === 'ancillary'

  const split = useMemo(() => splitStreamingMarkdownBlocks(content), [content])
  const targetText = split.degradeToPlainText ? content : split.activeBlock

  const [visibleLength, setVisibleLength] = useState(0)
  const stableBlockCountRef = useRef(split.stableBlockCount)
  const visibleLengthRef = useRef(0)
  const targetTextRef = useRef(targetText)

  targetTextRef.current = targetText
  visibleLengthRef.current = visibleLength

  useEffect(() => {
    if (split.stableBlockCount !== stableBlockCountRef.current) {
      stableBlockCountRef.current = split.stableBlockCount
      visibleLengthRef.current = 0
      setVisibleLength(0)
    }
  }, [split.stableBlockCount])

  useEffect(() => {
    if (!isStreaming) {
      setVisibleLength(targetText.length)
      visibleLengthRef.current = targetText.length
      return
    }

    const backlog = targetText.length - visibleLengthRef.current
    if (backlog >= CATCH_UP_THRESHOLD) {
      const next = Math.min(targetText.length, visibleLengthRef.current + backlog - 8)
      visibleLengthRef.current = next
      setVisibleLength(next)
    }

    const timer = setInterval(() => {
      const target = targetTextRef.current
      const current = visibleLengthRef.current
      if (current >= target.length) return

      const next = Math.min(target.length, current + PRINT_CHUNK_SIZE)
      visibleLengthRef.current = next
      setVisibleLength(next)
    }, PRINT_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [isStreaming, targetText, split.stableBlockCount])

  const typingStyle = useMemo(
    () => [
      isAncillary ? fluidTypingTextStyles.ancillary : fluidTypingTextStyles.chat,
      { color: isAncillary ? colors.textSecondary : colors.textPrimary },
      style as object
    ],
    [colors.textPrimary, colors.textSecondary, isAncillary, style]
  )

  if (!content) return null

  if (split.degradeToPlainText) {
    return (
      <View style={styles.root}>
        <FluidTypingText text={content} visibleLength={visibleLength} style={typingStyle} />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {split.stableMarkdown ? (
        <MarkdownRenderer
          content={split.stableMarkdown}
          variant={variant}
          style={style}
          resolveImageUri={resolveImageUri}
          loadImageUri={loadImageUri}
          onImagePress={onImagePress}
        />
      ) : null}
      {targetText ? (
        <FluidTypingText text={targetText} visibleLength={visibleLength} style={typingStyle} />
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch'
  }
})
