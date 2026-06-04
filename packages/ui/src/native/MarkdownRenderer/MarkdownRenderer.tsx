import React, { useMemo } from 'react'
import { View, StyleSheet, Image, Pressable } from 'react-native'
import Markdown, { MarkdownIt } from 'react-native-markdown-display'
import { useNativeTheme } from '../theme'

export interface MarkdownRendererProps {
  content: string
  style?: object
  /** 将 attachment/xxx 转为可加载的 file:// URI */
  resolveImageUri?: (src: string) => string | null | undefined
  onImagePress?: (src: string, resolvedUri: string) => void
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  style,
  resolveImageUri,
  onImagePress
}) => {
  const { colors } = useNativeTheme()

  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: colors.textPrimary,
          fontSize: 16,
          lineHeight: 24
        },
        heading1: {
          color: colors.textPrimary,
          fontSize: 24,
          fontWeight: 'bold',
          marginTop: 16,
          marginBottom: 8
        },
        heading2: {
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: 'bold',
          marginTop: 14,
          marginBottom: 6
        },
        heading3: {
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: 'bold',
          marginTop: 12,
          marginBottom: 4
        },
        heading4: {
          color: colors.textPrimary,
          fontSize: 17,
          fontWeight: '600',
          marginTop: 10,
          marginBottom: 4
        },
        heading5: {
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: '600',
          marginTop: 8,
          marginBottom: 6
        },
        heading6: {
          color: colors.textSecondary,
          fontSize: 15,
          fontWeight: '600',
          marginTop: 6,
          marginBottom: 4
        },
        paragraph: {
          color: colors.textPrimary,
          marginBottom: 8
        },
        link: {
          color: colors.primary,
          textDecorationLine: 'none'
        },
        blockquote: {
          backgroundColor: colors.bgSurfaceHighest,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 8
        },
        code_inline: {
          backgroundColor: colors.bgSurfaceHighest,
          color: colors.textPrimary,
          paddingHorizontal: 4,
          paddingVertical: 2,
          borderRadius: 4,
          fontFamily: 'monospace'
        },
        code_block: {
          backgroundColor: colors.bgSurfaceHighest,
          color: colors.textPrimary,
          padding: 12,
          borderRadius: 8,
          fontFamily: 'monospace',
          marginBottom: 8
        },
        fence: {
          backgroundColor: colors.bgSurfaceHighest,
          color: colors.textPrimary,
          padding: 12,
          borderRadius: 8,
          fontFamily: 'monospace',
          marginBottom: 8
        },
        list_item: {
          color: colors.textPrimary
        },
        bullet_list: {
          marginBottom: 8
        },
        ordered_list: {
          marginBottom: 8
        },
        hr: {
          backgroundColor: colors.borderSubtle,
          height: 1,
          marginVertical: 16
        },
        table: {
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          marginBottom: 8
        },
        thead: {
          backgroundColor: colors.bgSurfaceHighest
        },
        tbody: {
          backgroundColor: colors.bgSurface
        },
        th: {
          padding: 8,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          color: colors.textPrimary,
          fontWeight: 'bold'
        },
        td: {
          padding: 8,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          color: colors.textPrimary
        },
        tr: {
          borderBottomWidth: 1,
          borderColor: colors.borderSubtle
        },
        image: {
          marginVertical: 8,
          borderRadius: 8,
          overflow: 'hidden'
        }
      }),
    [colors]
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
    <View style={[styles.container, style]}>
      <Markdown style={markdownStyles} rules={rules} markdownit={markdownit}>
        {displayContent}
      </Markdown>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
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
