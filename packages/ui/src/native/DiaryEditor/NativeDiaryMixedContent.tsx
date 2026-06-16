import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef
} from 'react'
import {
  View,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
  type TextInput as RNTextInput
} from 'react-native'
import { Input } from '../Input/Input'
import { getHeroInputFieldStyle } from '../Input/input-field.styles'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import { NativeMarkdownImage } from '../MarkdownRenderer/NativeMarkdownImage'
import {
  extractDiaryAttachmentSrcs,
  parseDiaryContentBlocks,
  serializeDiaryContentBlocks,
  type DiaryContentBlock
} from './diary-image-markdown.util'

const EDITOR_SHELL_MIN_HEIGHT = 320
const LAST_TEXT_MIN_HEIGHT = 160
const EMPTY_TEXT_MIN_HEIGHT = 40
const TEXT_LINE_HEIGHT = 24

function ensureEditableBlocks(blocks: DiaryContentBlock[], mode: 'edit' | 'preview') {
  if (mode !== 'edit') return blocks

  let result = [...blocks]
  if (result[0]?.type === 'image') {
    result = [{ type: 'text', content: '', from: 0, to: 0 }, ...result]
  }
  const last = result[result.length - 1]
  if (last?.type === 'image') {
    const end = serializeDiaryContentBlocks(result).length
    result = [...result, { type: 'text', content: '', from: end, to: end }]
  }
  return result
}

function getLastTextBlockIndex(blocks: DiaryContentBlock[]): number {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i]?.type === 'text') return i
  }
  return -1
}

function getTextBlockMinHeight(
  block: Extract<DiaryContentBlock, { type: 'text' }>,
  index: number,
  blocks: DiaryContentBlock[],
  mode: 'edit' | 'preview'
): number {
  if (mode !== 'edit') return TEXT_LINE_HEIGHT
  const lastTextIndex = getLastTextBlockIndex(blocks)
  if (index === lastTextIndex) return LAST_TEXT_MIN_HEIGHT
  const trimmed = block.content.replace(/\u200B/g, '').trim()
  if (!trimmed) return EMPTY_TEXT_MIN_HEIGHT
  const lines = Math.max(1, block.content.split('\n').length)
  return Math.max(EMPTY_TEXT_MIN_HEIGHT, lines * TEXT_LINE_HEIGHT)
}

export interface NativeDiaryMixedContentHandle {
  focusAtOffset: (offset: number) => void
  blur: () => void
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
  const blocks = useMemo(
    () => ensureEditableBlocks(parseDiaryContentBlocks(content), mode),
    [content, mode]
  )
  const singleInputRef = useRef<RNTextInput | null>(null)
  const inputRefs = useRef<Array<RNTextInput | null>>([])
  const lastTextBlockIndex = useMemo(() => getLastTextBlockIndex(blocks), [blocks])

  const editorShellStyle = useMemo(
    () => [getHeroInputFieldStyle(colors, { multiline: true }), styles.editorShell],
    [colors]
  )

  const focusTextBlock = useCallback(
    (index: number) => {
      const input = inputRefs.current[index]
      input?.focus()
      const block = blocks[index]
      if (block?.type === 'text') {
        const end = block.content.length
        input?.setNativeProps?.({ selection: { start: end, end: end } })
      }
    },
    [blocks]
  )

  useImperativeHandle(ref, () => ({
    focusAtOffset(offset: number) {
      if (!hasImages) {
        singleInputRef.current?.focus()
        singleInputRef.current?.setNativeProps?.({ selection: { start: offset, end: offset } })
        return
      }

      let pos = 0
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        const len = block.type === 'text' ? block.content.length : block.raw.length
        if (offset <= pos + len) {
          if (block.type === 'text') {
            const local = Math.max(0, Math.min(offset - pos, block.content.length))
            const input = inputRefs.current[i]
            input?.focus()
            input?.setNativeProps?.({ selection: { start: local, end: local } })
          }
          return
        }
        pos += len
      }

      if (lastTextBlockIndex >= 0) {
        focusTextBlock(lastTextBlockIndex)
      }
    },
    blur() {
      if (!hasImages) {
        singleInputRef.current?.blur()
        return
      }
      for (const input of inputRefs.current) {
        input?.blur()
      }
    }
  }))

  const handleTextChange = useCallback(
    (blockIndex: number, newText: string) => {
      if (!onChange) return
      const next = blocks.map((block, index) =>
        index === blockIndex && block.type === 'text' ? { ...block, content: newText } : block
      )
      onChange(serializeDiaryContentBlocks(next))
    },
    [blocks, onChange]
  )

  const handleTextSelectionChange = useCallback(
    (blockIndex: number, start: number, end: number) => {
      const block = blocks[blockIndex]
      if (!block || block.type !== 'text') return
      onSelectionChange?.(block.from + start, block.from + end)
    },
    [blocks, onSelectionChange]
  )

  const getTextSelection = useCallback(
    (block: Extract<(typeof blocks)[number], { type: 'text' }>) => {
      if (!selection) return undefined
      const overlapStart = Math.max(selection.start, block.from)
      const overlapEnd = Math.min(selection.end, block.to)
      if (overlapStart > overlapEnd) return undefined
      return {
        start: overlapStart - block.from,
        end: overlapEnd - block.from
      }
    },
    [selection]
  )

  const renderInlineBlocks = () =>
    blocks.map((block, index) => {
      if (block.type === 'image') {
        return (
          <View key={`image-${index}-${block.from}`} style={styles.inlineImageWrap}>
            <NativeMarkdownImage
              rawSrc={block.src}
              alt={block.alt}
              imageStyle={styles.inlineImage}
              syncUri={resolveImageUri?.(block.src) ?? null}
              loadImageUri={loadImageUri}
              onPress={mode === 'preview' ? onImagePress : undefined}
            />
          </View>
        )
      }

      if (mode === 'edit') {
        const blockSelection = getTextSelection(block)
        const minHeight = getTextBlockMinHeight(block, index, blocks, mode)
        const isLastText = index === lastTextBlockIndex
        return (
          <View
            key={`text-${index}-${block.from}`}
            style={[styles.inlineTextWrap, isLastText && styles.inlineTextWrapLast, { minHeight }]}
          >
            <Input
              ref={(node) => {
                inputRefs.current[index] = node
              }}
              style={[styles.inlineTextArea, { minHeight }]}
              multiline
              scrollEnabled={false}
              keyboardAware
              placeholder={index === 0 ? placeholder : undefined}
              value={block.content}
              selection={blockSelection}
              onChangeText={(text) => handleTextChange(index, text)}
              onSelectionChange={(e) => {
                const { start, end } = e.nativeEvent.selection
                handleTextSelectionChange(index, start, end)
              }}
              onFocus={onFocus}
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

  const handleShellPress = useCallback(() => {
    if (mode !== 'edit' || lastTextBlockIndex < 0) return
    focusTextBlock(lastTextBlockIndex)
  }, [focusTextBlock, lastTextBlockIndex, mode])

  if (mode === 'edit' && !hasImages) {
    return (
      <Input
        ref={singleInputRef}
        style={styles.singleTextArea}
        multiline
        textarea
        keyboardAware
        placeholder={placeholder}
        value={content}
        selection={selection}
        onChangeText={onChange}
        onSelectionChange={(e) => {
          const { start, end } = e.nativeEvent.selection
          onSelectionChange?.(start, end)
        }}
        onFocus={onFocus}
        onContentSizeChange={(e) => {
          const h = e.nativeEvent.contentSize.height
          if (h > 0) onContentSizeChange?.(h)
        }}
      />
    )
  }

  const body = (
    <View
      style={editorShellStyle}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height
        if (h > 0) onContentSizeChange?.(h)
      }}
    >
      {renderInlineBlocks()}
    </View>
  )

  if (mode === 'edit') {
    return (
      <TouchableWithoutFeedback onPress={handleShellPress} accessible={false}>
        {body}
      </TouchableWithoutFeedback>
    )
  }

  return (
    <Pressable onPress={onPress} style={styles.previewArea}>
      {body}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  singleTextArea: {
    minHeight: EDITOR_SHELL_MIN_HEIGHT,
    fontSize: 16,
    lineHeight: TEXT_LINE_HEIGHT,
    textAlignVertical: 'top'
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
  inlineTextWrap: {
    width: '100%'
  },
  inlineTextWrapLast: {
    flexGrow: 1
  },
  inlineTextArea: {
    width: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    fontSize: 16,
    lineHeight: TEXT_LINE_HEIGHT,
    textAlignVertical: 'top'
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
