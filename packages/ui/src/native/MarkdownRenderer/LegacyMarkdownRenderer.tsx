import React, { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Markdown, { MarkdownIt } from 'react-native-markdown-display'
import { useNativeTheme } from '../theme'
import {
  parseImageSrcWithoutWidth,
  stripImageWidthInMarkdown
} from '../DiaryEditor/diary-image-markdown.util'
import { markdownSpacingTokens, mobileTypography, sharedTokens } from '../../theme/tokens'
import { NativeMarkdownImage } from './NativeMarkdownImage'
import { useMarkdownLinkPress } from './useMarkdownLinkPress'
import {
  buildStreamingMarkdownRules,
  createStreamingElementMemoizer,
  getStableAstNodeKey,
  type MarkdownAstNodeLike
} from './legacy-markdown-streaming-tail'
import type { MarkdownRendererProps } from './MarkdownRenderer'

function buildMarkdownStyles(
  colors: ReturnType<typeof useNativeTheme>['colors'],
  variant: NonNullable<MarkdownRendererProps['variant']>
) {
  const isPreview = variant === 'preview'
  const isAncillary = variant === 'ancillary'
  const isChat = variant === 'chat' || isAncillary
  const bodyFontSize = isAncillary
    ? mobileTypography.secondary.fontSize
    : mobileTypography.body.fontSize
  const bodyLineHeight = isAncillary ? 20 : mobileTypography.body.lineHeight
  const bodyColor = isAncillary ? colors.textSecondary : colors.textPrimary
  const paragraphMargin = isPreview
    ? markdownSpacingTokens.paragraphPreview
    : markdownSpacingTokens.paragraph
  const listMargin = isChat ? markdownSpacingTokens.listCompact : markdownSpacingTokens.list
  const headingWeight = mobileTypography.title.fontWeight
  const codeFontSize = isPreview
    ? bodyFontSize
    : isAncillary
      ? mobileTypography.caption.fontSize
      : mobileTypography.secondary.fontSize
  const h = markdownSpacingTokens.headings

  return StyleSheet.create({
    body: {
      color: bodyColor,
      fontSize: bodyFontSize,
      lineHeight: bodyLineHeight
    },
    heading1: {
      color: colors.textPrimary,
      fontSize: mobileTypography.title.fontSize,
      fontWeight: headingWeight,
      marginTop: isChat ? h.h1.topCompact : h.h1.top,
      marginBottom: isChat ? h.h1.bottomCompact : h.h1.bottom
    },
    heading2: {
      color: colors.textPrimary,
      fontSize: mobileTypography.title.fontSize,
      fontWeight: headingWeight,
      marginTop: isChat ? h.h2.topCompact : h.h2.top,
      marginBottom: isChat ? h.h2.bottomCompact : h.h2.bottom
    },
    heading3: {
      color: colors.textPrimary,
      fontSize: mobileTypography.primary.fontSize,
      fontWeight: headingWeight,
      marginTop: isChat ? h.h3.topCompact : h.h3.top,
      marginBottom: h.h3.bottom
    },
    heading4: {
      color: colors.textPrimary,
      fontSize: mobileTypography.primary.fontSize,
      fontWeight: headingWeight,
      marginTop: isChat ? h.h4.topCompact : h.h4.top,
      marginBottom: h.h4.bottom
    },
    heading5: {
      color: colors.textPrimary,
      fontSize: mobileTypography.body.fontSize,
      fontWeight: headingWeight,
      marginTop: isChat ? h.h5.topCompact : h.h5.top,
      marginBottom: h.h5.bottom
    },
    heading6: {
      color: isPreview ? colors.primary : colors.textSecondary,
      fontSize: mobileTypography.body.fontSize,
      fontWeight: headingWeight,
      marginTop: isPreview ? 0 : isChat ? h.h6.topCompact : h.h6.top,
      marginBottom: isPreview ? h.h6.bottomCompact : h.h6.bottom
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
      backgroundColor: isPreview
        ? colors.bgSurface
        : (colors.bgSurfaceLow ?? colors.bgSurfaceNormal),
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderTopRightRadius: sharedTokens.radius.sm,
      borderBottomRightRadius: sharedTokens.radius.sm,
      paddingHorizontal: sharedTokens.spacing.mdTight,
      paddingVertical: isPreview ? sharedTokens.spacing.xxs : sharedTokens.spacing.sm,
      marginBottom: paragraphMargin,
      color: colors.textSecondary
    },
    code_inline: {
      backgroundColor: colors.bgSurfaceNormal,
      color: colors.textPrimary,
      paddingHorizontal: sharedTokens.spacing.xs,
      paddingVertical: 1,
      borderRadius: sharedTokens.radius.xs,
      fontSize: codeFontSize
    },
    code_block: {
      backgroundColor: colors.bgSurfaceNormal,
      color: colors.textPrimary,
      padding: sharedTokens.spacing.smPlus,
      borderRadius: sharedTokens.radius.sm,
      fontFamily: 'monospace',
      marginBottom: paragraphMargin,
      fontSize: codeFontSize
    },
    fence: {
      backgroundColor: colors.bgSurfaceNormal,
      color: colors.textPrimary,
      padding: sharedTokens.spacing.smPlus,
      borderRadius: sharedTokens.radius.sm,
      fontFamily: 'monospace',
      marginBottom: paragraphMargin,
      fontSize: codeFontSize
    },
    list_item: {
      color: bodyColor,
      marginBottom: isChat ? markdownSpacingTokens.listItemCompact : markdownSpacingTokens.listItem
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
      marginVertical: isPreview
        ? markdownSpacingTokens.dividerPreview
        : isChat
          ? markdownSpacingTokens.dividerCompact
          : markdownSpacingTokens.divider
    },
    table: {
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      marginBottom: paragraphMargin
    },
    thead: {
      backgroundColor: colors.bgSurfaceNormal
    },
    tbody: {
      backgroundColor: colors.bgSurface
    },
    th: {
      padding: sharedTokens.spacing.xsPlus,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary,
      fontWeight: 'bold'
    },
    td: {
      padding: sharedTokens.spacing.xsPlus,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      color: colors.textPrimary
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.borderSubtle
    },
    image: {
      marginVertical: sharedTokens.spacing.xsPlus,
      borderRadius: sharedTokens.radius.sm,
      overflow: 'hidden'
    }
  })
}

/** 异步 attachment 图片等场景回退到 react-native-markdown-display */
export const LegacyMarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  style,
  variant = 'default',
  streamingTailFadeChars = 0,
  resolveImageUri,
  loadImageUri,
  onImagePress
}) => {
  const { colors } = useNativeTheme()
  const { tryOpenCitation } = useMarkdownLinkPress()
  const defaultBodyColor = variant === 'ancillary' ? colors.textSecondary : colors.textPrimary
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
  const imageCallbacksRef = React.useRef({ resolveImageUri, loadImageUri, onImagePress })
  imageCallbacksRef.current = { resolveImageUri, loadImageUri, onImagePress }
  const tailFadeCharsRef = React.useRef(streamingTailFadeChars)
  tailFadeCharsRef.current = streamingTailFadeChars
  const prevDisplayContentRef = React.useRef(displayContent)
  const prevTailFadeCharsRef = React.useRef(streamingTailFadeChars)
  const tailDrainRevisionRef = React.useRef(0)
  if (
    prevDisplayContentRef.current === displayContent &&
    prevTailFadeCharsRef.current !== streamingTailFadeChars
  ) {
    tailDrainRevisionRef.current += 1
  }
  prevDisplayContentRef.current = displayContent
  prevTailFadeCharsRef.current = streamingTailFadeChars
  const tailDrainRevision = tailDrainRevisionRef.current
  const handleLinkPress = React.useCallback(
    (url: string) => !tryOpenCitation(url),
    [tryOpenCitation]
  )
  const rules = useMemo(() => {
    const memoizer = createStreamingElementMemoizer()
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

    const isLastBlockChild = (
      node: { key: string },
      parentNodes?: Array<{ children?: Array<{ key: string }> }>
    ) => {
      const parent = parentNodes?.[0]
      if (!parent?.children || parent.children.length === 0) return false
      return parent.children[parent.children.length - 1]?.key === node.key
    }

    const blockRules = {
      paragraph: (
        node: { key: string; index?: number; type?: string },
        children: React.ReactNode,
        parentNodes: Array<{ key?: string; index?: number; children?: Array<{ key: string }> }>,
        styles: { _VIEW_SAFE_paragraph?: object }
      ) => {
        const isLast = isLastBlockChild(node, parentNodes)
        const stableKey = getStableAstNodeKey(node, parentNodes as MarkdownAstNodeLike[])
        return memoizer.memoizeContainer(
          stableKey,
          children,
          styles._VIEW_SAFE_paragraph,
          isLast,
          () => (
            <View
              key={stableKey}
              style={[styles._VIEW_SAFE_paragraph, isLast ? legacyStyles.lastBlock : null]}
            >
              {children}
            </View>
          )
        )
      },
      blockquote: (
        node: { key: string; index?: number; type?: string },
        children: React.ReactNode,
        parentNodes: Array<{ key?: string; index?: number; children?: Array<{ key: string }> }>,
        styles: { _VIEW_SAFE_blockquote?: object }
      ) => {
        const isLast = isLastBlockChild(node, parentNodes)
        const stableKey = getStableAstNodeKey(node, parentNodes as MarkdownAstNodeLike[])
        return memoizer.memoizeContainer(
          stableKey,
          children,
          styles._VIEW_SAFE_blockquote,
          isLast,
          () => (
            <View
              key={stableKey}
              style={[styles._VIEW_SAFE_blockquote, isLast ? legacyStyles.lastBlock : null]}
            >
              {children}
            </View>
          )
        )
      }
    }

    const imageRule = {
      image: (
        node: { key: string; attributes: { src?: string; alt?: string } },
        _children: unknown,
        _parent: unknown,
        _styles: { image?: object }
      ) => {
        const rawSrc = parseImageSrcWithoutWidth(node.attributes.src ?? '')
        const {
          resolveImageUri: currentResolve,
          loadImageUri: currentLoad,
          onImagePress: currentPress
        } = imageCallbacksRef.current
        const syncUri = currentResolve?.(rawSrc) ?? rawSrc
        const imageStyle = [_styles.image, legacyStyles.image, legacyStyles.imageBlock]

        return (
          <NativeMarkdownImage
            key={node.key}
            rawSrc={rawSrc}
            alt={node.attributes.alt}
            imageStyle={imageStyle}
            syncUri={syncUri}
            loadImageUri={currentLoad}
            onPress={currentPress}
          />
        )
      }
    }

    const streamingRules =
      variant !== 'preview'
        ? buildStreamingMarkdownRules({
            tailFadeCharsRef,
            defaultTextColor: defaultBodyColor,
            memoizer,
            revision: tailDrainRevision
          })
        : {}

    return {
      ...streamingRules,
      ...blockRules,
      ...previewTextRules,
      ...imageRule
    }
  }, [defaultBodyColor, tailDrainRevision, variant])

  return (
    <View
      style={[
        variant === 'default' ? legacyStyles.containerDefault : legacyStyles.containerCompact,
        style
      ]}
    >
      <Markdown
        style={markdownStyles}
        rules={rules}
        markdownit={markdownit}
        onLinkPress={handleLinkPress}
      >
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
  lastBlock: {
    marginBottom: 0
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
