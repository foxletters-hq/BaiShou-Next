import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Markdown, { MarkdownIt } from 'react-native-markdown-display'
import { useNativeTheme } from '../theme'
import {
  parseImageSrcWithoutWidth,
  stripImageWidthInMarkdown
} from '../DiaryEditor/diary-image-markdown.util'
import { NativeMarkdownImage } from './NativeMarkdownImage'
import type { MarkdownRendererProps } from './MarkdownRenderer'

function buildMarkdownStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  variant: NonNullable<MarkdownRendererProps['variant']>
) {
  const isPreview = variant === 'preview'
  const isAncillary = variant === 'ancillary'
  const isChat = variant === 'chat' || isAncillary
  const bodyFontSize = isAncillary ? 14 : 15
  const bodyLineHeight = isAncillary ? 20 : 24
  const bodyColor = isAncillary ? colors.textSecondary : colors.textPrimary
  const paragraphMargin = isAncillary ? 4 : isChat ? 0 : 8
  const listMargin = isChat ? 4 : 8
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
      color: isPreview ? colors.primary : colors.textSecondary,
      fontSize: isPreview ? 15 : Math.round(15 * headingScale),
      fontWeight: '600',
      marginTop: isPreview ? 0 : isChat ? 4 : 6,
      marginBottom: isPreview ? 2 : 4
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
      backgroundColor: isPreview ? colors.bgSurface : colors.bgSurfaceHighest,
      borderLeftWidth: isPreview ? 3 : 4,
      borderLeftColor: colors.primary,
      paddingHorizontal: isPreview ? 12 : 10,
      paddingVertical: isPreview ? 2 : 6,
      marginBottom: paragraphMargin,
      color: isPreview ? colors.textSecondary : bodyColor
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
      backgroundColor: isPreview ? colors.borderSubtle : colors.borderMuted,
      height: 1,
      marginVertical: isPreview ? 8 : isChat ? 10 : 16
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

/** 异步 attachment 图片等场景回退到 react-native-markdown-display */
export const LegacyMarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  style,
  variant = 'default',
  resolveImageUri,
  loadImageUri,
  onImagePress
}) => {
  const { colors } = useNativeTheme()
  const markdownStyles = useMemo(() => buildMarkdownStyles(colors, variant), [colors, variant])
  const markdownit = useMemo(
    () =>
      MarkdownIt({
        typographer: true,
        breaks: true
      }),
    []
  )
  const displayContent = useMemo(
    () => stripImageWidthInMarkdown(content.replace(/\u200B/g, '')),
    [content]
  )
  const rules = useMemo(() => {
    const previewTextRules =
      variant === 'preview'
        ? {
            text: (
              node: { key: string; content: string },
              _children: unknown,
              _parent: unknown,
              styles: { text?: object },
              inheritedStyles: object = {}
            ) => (
              <Text key={node.key} style={[inheritedStyles, styles.text]} selectable={false}>
                {node.content}
              </Text>
            ),
            textgroup: (
              node: { key: string },
              children: React.ReactNode,
              _parent: unknown,
              styles: { textgroup?: object }
            ) => (
              <Text key={node.key} style={styles.textgroup} selectable={false}>
                {children}
              </Text>
            ),
            hardbreak: (
              node: { key: string },
              _children: unknown,
              _parent: unknown,
              styles: { hardbreak?: object }
            ) => (
              <Text key={node.key} style={styles.hardbreak} selectable={false}>
                {'\n'}
              </Text>
            ),
            softbreak: (
              node: { key: string },
              _children: unknown,
              _parent: unknown,
              styles: { softbreak?: object }
            ) => (
              <Text key={node.key} style={styles.softbreak} selectable={false}>
                {'\n'}
              </Text>
            )
          }
        : {}

    if (
      !resolveImageUri &&
      !loadImageUri &&
      !onImagePress &&
      Object.keys(previewTextRules).length === 0
    ) {
      // 仍覆盖默认 FitImage，避免 React 对 `{...{ key }}` 展开告警
      return {
        image: (
          node: { key: string; attributes: { src?: string; alt?: string } },
          _children: unknown,
          _parent: unknown,
          _styles: { image?: object }
        ) => {
          const rawSrc = parseImageSrcWithoutWidth(node.attributes.src ?? '')
          return (
            <NativeMarkdownImage
              key={node.key}
              rawSrc={rawSrc}
              alt={node.attributes.alt}
              imageStyle={[_styles.image, legacyStyles.image, legacyStyles.imageBlock]}
              syncUri={rawSrc}
            />
          )
        }
      }
    }
    return {
      ...previewTextRules,
      image: (
        node: { key: string; attributes: { src?: string; alt?: string } },
        _children: unknown,
        _parent: unknown,
        _styles: { image?: object }
      ) => {
        const rawSrc = parseImageSrcWithoutWidth(node.attributes.src ?? '')
        const syncUri = resolveImageUri?.(rawSrc) ?? rawSrc
        const imageStyle = [_styles.image, legacyStyles.image, legacyStyles.imageBlock]

        return (
          <NativeMarkdownImage
            key={node.key}
            rawSrc={rawSrc}
            alt={node.attributes.alt}
            imageStyle={imageStyle}
            syncUri={syncUri}
            loadImageUri={loadImageUri}
            onPress={onImagePress}
          />
        )
      }
    }
  }, [variant, resolveImageUri, loadImageUri, onImagePress])

  return (
    <View
      style={[
        variant === 'default' ? legacyStyles.containerDefault : legacyStyles.containerCompact,
        style
      ]}
    >
      <Markdown style={markdownStyles} rules={rules} markdownit={markdownit}>
        {displayContent}
      </Markdown>
    </View>
  )
}

const legacyStyles = StyleSheet.create({
  /** ScrollView 内勿用 flex:1，否则测高/测宽异常导致正文被裁切 */
  containerDefault: {
    alignSelf: 'stretch',
    width: '100%',
    minWidth: 0
  },
  containerCompact: {
    alignSelf: 'stretch',
    width: '100%'
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
