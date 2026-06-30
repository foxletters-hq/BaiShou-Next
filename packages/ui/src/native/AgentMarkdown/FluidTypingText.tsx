import React, { useMemo } from 'react'
import { Text, StyleSheet, type TextStyle, type StyleProp } from 'react-native'

const DEFAULT_TAIL_CHAR_COUNT = 9

export interface FluidTypingTextProps {
  text: string
  /** 已打印字符数（按 JS string length） */
  visibleLength: number
  style?: StyleProp<TextStyle>
  /** 尾部渐变字符数 */
  tailCharCount?: number
}

function buildTailOpacities(count: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [0.55]
  const opacities: number[] = []
  for (let i = 0; i < count; i++) {
    const t = (i + 1) / count
    opacities.push(0.25 + t * 0.75)
  }
  return opacities
}

/**
 * 流式打字文本：主体一次性渲染，尾部若干字符拆成 opacity 渐变。
 */
export const FluidTypingText = React.memo(function FluidTypingText({
  text,
  visibleLength,
  style,
  tailCharCount = DEFAULT_TAIL_CHAR_COUNT
}: FluidTypingTextProps) {
  const clampedLength = Math.max(0, Math.min(visibleLength, text.length))
  const visibleText = text.slice(0, clampedLength)

  const { stableText, tailChars, tailOpacities } = useMemo(() => {
    if (!visibleText) {
      return { stableText: '', tailChars: [] as string[], tailOpacities: [] as number[] }
    }

    const tailCount = Math.min(tailCharCount, visibleText.length)
    const stableLen = visibleText.length - tailCount
    const stable = stableLen > 0 ? visibleText.slice(0, stableLen) : ''
    const tail = visibleText.slice(stableLen)
    const chars = [...tail]

    return {
      stableText: stable,
      tailChars: chars,
      tailOpacities: buildTailOpacities(chars.length)
    }
  }, [visibleText, tailCharCount])

  if (!visibleText) return null

  return (
    <Text style={style}>
      {stableText ? <Text style={style}>{stableText}</Text> : null}
      {tailChars.map((char, index) => (
        <Text key={`${index}-${char}`} style={[style, { opacity: tailOpacities[index] }]}>
          {char}
        </Text>
      ))}
    </Text>
  )
})

export const fluidTypingTextStyles = StyleSheet.create({
  chat: {
    fontSize: 15,
    lineHeight: 24
  },
  ancillary: {
    fontSize: 14,
    lineHeight: 20
  }
})
