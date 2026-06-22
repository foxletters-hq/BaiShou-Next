import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  type TextInput as RNTextInput,
  type ViewStyle
} from 'react-native'
import { Input } from '../Input/Input'
import { getHeroInputFieldStyle } from '../Input/input-field.styles'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import { NativeMarkdownImage } from '../MarkdownRenderer/NativeMarkdownImage'
import { NativeDiaryInlineImageOverlays } from './NativeDiaryInlineImageOverlays'
import {
  ensureInlineImagePreviewSlots,
  extractDiaryAttachmentSrcs,
  getCursorOffsetAfterInlineImage,
  getInlineImageBlocks,
  maskImageMarkdownLines,
  mergeMaskedEditorContent,
  parseDiaryContentBlocks,
  type InlineImageBlock
} from './diary-image-markdown.util'

const TEXT_LINE_HEIGHT = 24
const CARET_VISIBLE_LINES = 5
const INPUT_PADDING_TOP = 12
const EDITOR_SHELL_MIN_HEIGHT = 320
const COMPACT_EDITOR_MAX_HEIGHT = EDITOR_SHELL_MIN_HEIGHT + 48

export interface NativeDiaryMixedContentHandle {
  focusAtOffset: (offset: number) => void
  blur: () => void
  measureActiveEditorInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void
}

export interface NativeDiaryMixedContentProps {
  content: string
  mode: 'edit' | 'preview'
  placeholder?: string
  selection?: { start: number; end: number }
  onChange?: (content: string) => void
  onSelectionChange?: (start: number, end: number) => void
  onContentSizeChange?: (height: number) => void
  onPress?: () => void
  onFocus?: () => void
  resolveImageUri?: (src: string) => string | null | undefined
  loadImageUri?: (src: string) => Promise<string | null>
  onImagePress?: (src: string, resolvedUri: string) => void
}

export const NativeDiaryMixedContent = forwardRef<
  NativeDiaryMixedContentHandle,
  NativeDiaryMixedContentProps
>(function NativeDiaryMixedContent(
  {
    content,
    mode,
    placeholder,
    selection,
    onChange,
    onSelectionChange,
    onContentSizeChange,
    onPress,
    onFocus,
    resolveImageUri,
    loadImageUri,
    onImagePress
  },
  ref
) {
  const { colors } = useNativeTheme()
  const hasImages = useMemo(() => extractDiaryAttachmentSrcs(content).length > 0, [content])
  const previewBlocks = useMemo(() => parseDiaryContentBlocks(content), [content])
  const inlineImageBlocks = useMemo(() => getInlineImageBlocks(content), [content])
  const maskedContent = useMemo(() => maskImageMarkdownLines(content), [content])
  const inputRef = useRef<RNTextInput | null>(null)
  const shellRef = useRef<View>(null)
  const caretOffsetRef = useRef(0)
  const selectionRef = useRef(selection)
  selectionRef.current = selection

  useEffect(() => {
    if (mode !== 'edit' || !hasImages) return
    const normalized = ensureInlineImagePreviewSlots(content)
    if (normalized !== content) {
      onChange?.(normalized)
    }
  }, [content, hasImages, mode, onChange])

  const editorShellStyle = useMemo((): ViewStyle[] => {
    const field = getHeroInputFieldStyle(colors, { multiline: true })
    return [
      {
        backgroundColor: field.backgroundColor,
        borderWidth: field.borderWidth,
        borderColor: field.borderColor,
        borderRadius: field.borderRadius
      },
      styles.editorShell
    ]
  }, [colors])

  const reportCaretRegionInWindow = useCallback(
    (
      measureHost: View | RNTextInput | null,
      text: string,
      caretOffset: number,
      callback: (x: number, y: number, width: number, height: number) => void
    ) => {
      const host = measureHost ?? shellRef.current
      if (!host?.measureInWindow) {
        shellRef.current?.measureInWindow(callback)
        return
      }

      host.measureInWindow((x, y, w, h) => {
        const safeOffset = Math.max(0, Math.min(caretOffset, text.length))
        const prefix = text.slice(0, safeOffset)
        const linesAbove = Math.max(1, prefix.split('\n').length)
        const caretLineTop = y + INPUT_PADDING_TOP + (linesAbove - 1) * TEXT_LINE_HEIGHT
        const regionHeight = TEXT_LINE_HEIGHT * CARET_VISIBLE_LINES
        const hostBottom = y + h
        const visibleBelowCaret = Math.max(0, hostBottom - caretLineTop)
        const regionOnlyHeight = Math.min(
          regionHeight,
          Math.max(visibleBelowCaret, TEXT_LINE_HEIGHT)
        )

        if (h > COMPACT_EDITOR_MAX_HEIGHT) {
          callback(x, caretLineTop, w, regionOnlyHeight)
          return
        }

        callback(x, caretLineTop, w, Math.max(regionOnlyHeight, hostBottom - caretLineTop))
      })
    },
    []
  )

  const focusInputAtOffset = useCallback((offset: number) => {
    const safeOffset = Math.max(0, Math.min(offset, content.length))
    inputRef.current?.focus()
    inputRef.current?.setNativeProps?.({ selection: { start: safeOffset, end: safeOffset } })
    caretOffsetRef.current = safeOffset
    onSelectionChange?.(safeOffset, safeOffset)
  }, [content.length, onSelectionChange])

  const handleEditImagePress = useCallback(
    (block: InlineImageBlock) => {
      focusInputAtOffset(getCursorOffsetAfterInlineImage(content, block))
    },
    [content, focusInputAtOffset]
  )

  useImperativeHandle(
    ref,
    () => ({
      focusAtOffset(offset: number) {
        focusInputAtOffset(offset)
      },
      blur() {
        inputRef.current?.blur()
      },
      measureActiveEditorInWindow(callback) {
        const currentSelection = selectionRef.current
        const caret =
          caretOffsetRef.current ||
          currentSelection?.end ||
          currentSelection?.start ||
          content.length
        reportCaretRegionInWindow(inputRef.current ?? shellRef.current, content, caret, callback)
      }
    }),
    [content, focusInputAtOffset, reportCaretRegionInWindow]
  )

  const renderPreviewBlocks = () =>
    previewBlocks.map((block, index) => {
      if (block.type === 'image') {
        return (
          <View key={`image-${index}-${block.from}`} style={styles.inlineImageWrap}>
            <NativeMarkdownImage
              rawSrc={block.src}
              alt={block.alt}
              imageStyle={styles.inlineImage}
              syncUri={resolveImageUri?.(block.src) ?? null}
              loadImageUri={loadImageUri}
              onPress={onImagePress}
            />
          </View>
        )
      }

      if (!block.content.trim()) {
        return <View key={`text-${block.from}`} style={styles.textSpacer} />
      }

      return (
        <MarkdownRenderer
          key={`text-${block.from}`}
          content={block.content}
          resolveImageUri={resolveImageUri}
          loadImageUri={loadImageUri}
          onImagePress={onImagePress}
        />
      )
    })

  if (mode === 'edit') {
    return (
      <View ref={shellRef} collapsable={false} style={styles.singleInputShell}>
        <View style={styles.inputOverlayHost}>
          <Input
            ref={inputRef}
            style={styles.singleTextArea}
            multiline
            scrollEnabled={false}
            keyboardAware={false}
            placeholder={placeholder}
            value={maskedContent}
            selection={selection}
            onChangeText={(text) => {
              onChange?.(mergeMaskedEditorContent(content, text))
            }}
            onSelectionChange={(e) => {
              const { start, end } = e.nativeEvent.selection
              caretOffsetRef.current = end
              onSelectionChange?.(start, end)
            }}
            onFocus={() => {
              caretOffsetRef.current =
                selectionRef.current?.end ?? selectionRef.current?.start ?? content.length
              onFocus?.()
            }}
            onContentSizeChange={(e) => {
              const h = e.nativeEvent.contentSize.height
              if (h > 0) onContentSizeChange?.(h)
            }}
          />
          {inlineImageBlocks.length > 0 && (
            <NativeDiaryInlineImageOverlays
              content={content}
              imageBlocks={inlineImageBlocks}
              backgroundColor={colors.bgSurface}
              resolveImageUri={resolveImageUri}
              loadImageUri={loadImageUri}
              onImagePress={handleEditImagePress}
            />
          )}
        </View>
      </View>
    )
  }

  if (!hasImages) {
    return (
      <Pressable onPress={onPress} style={styles.previewArea}>
        <MarkdownRenderer
          content={content}
          resolveImageUri={resolveImageUri}
          loadImageUri={loadImageUri}
          onImagePress={onImagePress}
        />
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={styles.previewArea}>
      <View style={editorShellStyle}>{renderPreviewBlocks()}</View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  singleInputShell: {
    alignSelf: 'stretch',
    width: '100%'
  },
  inputOverlayHost: {
    position: 'relative',
    width: '100%',
    zIndex: 0
  },
  singleTextArea: {
    minHeight: EDITOR_SHELL_MIN_HEIGHT,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
    zIndex: 0
  },
  editorShell: {
    minHeight: EDITOR_SHELL_MIN_HEIGHT,
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  previewArea: {
    minHeight: EDITOR_SHELL_MIN_HEIGHT,
    paddingBottom: 16
  },
  inlineImageWrap: {
    width: '100%',
    marginVertical: 6
  },
  inlineImage: {
    width: '100%',
    height: 200,
    maxHeight: 280,
    borderRadius: 8
  },
  textSpacer: {
    height: 4
  }
})
