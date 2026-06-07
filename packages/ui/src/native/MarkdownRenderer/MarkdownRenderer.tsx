import React, { useMemo } from 'react'
import { View, StyleSheet, Image, Pressable } from 'react-native'
import Markdown, { MarkdownIt } from 'react-native-markdown-display'
import { useNativeTheme } from '../theme'

export type MarkdownRendererVariant = 'default' | 'chat' | 'ancillary'

export interface MarkdownRendererProps {
  content: string
  style?: object
  /** chat：气泡正文；ancillary：思考块等附属内容 */
  variant?: MarkdownRendererVariant
  /** 将 attachment/xxx 转为可加载的 file:// URI */
  resolveImageUri?: (src: string) => string | null | undefined
  onImagePress?: (src: string, resolvedUri: string) => void
}

function buildMarkdownStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  variant: MarkdownRendererVariant
) {
  const isAncillary = variant === 'ancillary'
  const isChat = variant === 'chat' || isAncillary
  const bodyFontSize = isAncillary ? 14 : 15
  const bodyLineHeight = isAncillary ? 20 : 24
  const bodyColor = isAncillary ? colors.textSecondary : colors.textPrimary
  const paragraphMargin = isAncillary ? 4 : isChat ? 6 : 8
  const listMargin = isChat ? 6 : 8
  const headingScale = isChat ? 0.85 : 1

  return StyleSheet.create({
    body: {
      color: bodyColor,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight
    },
    heading1: {
      color: colors.textPrimary,
      fontSize: Math.round(24 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 12 : 16,
      marginBottom: isChat ? 6 : 8
    },
    heading2: {
      color: colors.textPrimary,
      fontSize: Math.round(20 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 10 : 14,
      marginBottom: isChat ? 4 : 6
    },
    heading3: {
      color: colors.textPrimary,
      fontSize: Math.round(18 * headingScale),
      fontWeight: 'bold',
      marginTop: isChat ? 8 : 12,
      marginBottom: 4
    },
    heading4: {
      color: colors.textPrimary,
      fontSize: Math.round(17 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 8 : 10,
      marginBottom: 4
    },
    heading5: {
      color: colors.textPrimary,
      fontSize: Math.round(16 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 6 : 8,
      marginBottom: 4
    },
    heading6: {
      color: colors.textSecondary,
      fontSize: Math.round(15 * headingScale),
      fontWeight: '600',
      marginTop: isChat ? 4 : 6,
      marginBottom: 4
    },
    paragraph: {
      color: bodyColor,
      marginTop: 0,
      marginBottom: paragraphMargin
    },
    link: {
      color: colors.primary,
      textDecorationLine: 'none'
    },
    blockquote: {
      backgroundColor: colors.bgSurfaceHighest,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginBottom: paragraphMargin
    },
    code_inline: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: isAncillary ? 12 : 13
    },
    code_block: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      padding: 10,
      borderRadius: 8,
      fontFamily: 'monospace',
      marginBottom: paragraphMargin,
      fontSize: isAncillary ? 12 : 13
    },
    fence: {
      backgroundColor: colors.bgSurfaceHighest,
      color: colors.textPrimary,
      padding: 10,
      borderRadius: 8,
      fontFamily: 'monospace',
      marginBottom: paragraphMargin,
      fontSize: isAncillary ? 12 : 13
    },
    list_item: {
      color: bodyColor,
      marginBottom: isChat ? 2 : 4
    },
    bullet_list: {
      marginTop: 0,
      marginBottom: listMargin
    },
    ordered_list: {
      marginTop: 0,
      marginBottom: listMargin
    },
    hr: {
      backgroundColor: colors.borderSubtle,
      height: 1,
      marginVertical: isChat ? 10 : 16
    },
    table: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: paragraphMargin
    },
    thead: {
      backgroundColor: colors.bgSurfaceHighest
    },
    tbody: {
      backgroundColor: colors.bgSurface
    },
    th: {
      padding: 6,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary,
      fontWeight: 'bold'
    },
    td: {
      padding: 6,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.borderSubtle
    },
    image: {
      marginVertical: 6,
      borderRadius: 8,
      overflow: 'hidden'
    }
  })
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  style,
  variant = 'default',
  resolveImageUri,
  onImagePress
}) => {
  const { colors } = useNativeTheme()

  const markdownStyles = useMemo(
    () => buildMarkdownStyles(colors, variant),
    [colors, variant]
  )

  const markdownit = useMemo(
    () =>
      MarkdownIt({
        typographer: true,
        breaks: true
      }),
    []
  )

  const displayContent = useMemo(() => content.replace(/\u200B/g, ''), [content])

  const rules = useMemo(() => {
    if (!resolveImageUri && !onImagePress) return undefined
    return {
      image: (
        node: { key: string; attributes: { src?: string; alt?: string } },
        _children: unknown,
        _parent: unknown,
        _styles: { image?: object }
      ) => {
        const rawSrc = node.attributes.src ?? ''
        const resolved = resolveImageUri?.(rawSrc) ?? rawSrc
        if (!resolved) return null

        const img = (
          <Image
            key={node.key}
            source={{ uri: resolved }}
            style={[_styles.image, styles.image, styles.imageBlock]}
            resizeMode="contain"
          />
        )

        if (!onImagePress) return img

        return (
          <Pressable
            key={node.key}
            onPress={() => onImagePress(rawSrc, resolved)}
            accessibilityRole="imagebutton"
          >
            {img}
          </Pressable>
        )
      }
    }
  }, [resolveImageUri, onImagePress])

  return (
    <View
      style={[
        variant === 'default' ? styles.containerDefault : styles.containerCompact,
        style
      ]}
    >
      <Markdown style={markdownStyles} rules={rules} markdownit={markdownit}>
        {displayContent}
      </Markdown>
    </View>
  )
}

const styles = StyleSheet.create({
  containerDefault: {
    flex: 1
  },
  containerCompact: {
    alignSelf: 'stretch'
  },
  image: {
    width: '100%',
    minHeight: 120,
    maxHeight: 360
  },
  imageBlock: {
    backgroundColor: 'transparent'
  }
})
