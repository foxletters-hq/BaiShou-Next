import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { NativeMarkdownImage } from '../MarkdownRenderer/NativeMarkdownImage'
import {
  DIARY_INLINE_IMAGE_LINE_HEIGHT,
  DIARY_INLINE_IMAGE_PREVIEW_HEIGHT,
  getLineIndexForOffset,
  type InlineImageBlock
} from './diary-image-markdown.util'

const INPUT_PADDING_TOP = 12
const INPUT_PADDING_HORIZONTAL = 12

interface NativeDiaryInlineImageOverlaysProps {
  content: string
  imageBlocks: InlineImageBlock[]
  backgroundColor: string
  resolveImageUri?: (src: string) => string | null | undefined
  loadImageUri?: (src: string) => Promise<string | null>
  onImagePress: (block: InlineImageBlock) => void
}

export const NativeDiaryInlineImageOverlays: React.FC<NativeDiaryInlineImageOverlaysProps> = ({
  content,
  imageBlocks,
  backgroundColor,
  resolveImageUri,
  loadImageUri,
  onImagePress
}) => {
  if (imageBlocks.length === 0) return null

  const overlayHeight = DIARY_INLINE_IMAGE_PREVIEW_HEIGHT

  return (
    <View pointerEvents="box-none" style={styles.overlayLayer}>
      {imageBlocks.map((block) => {
        const lineIndex = getLineIndexForOffset(content, block.from)
        return (
          <Pressable
            key={`${block.from}-${block.src}`}
            style={[
              styles.overlayItem,
              {
                top: INPUT_PADDING_TOP + lineIndex * DIARY_INLINE_IMAGE_LINE_HEIGHT,
                left: INPUT_PADDING_HORIZONTAL,
                right: INPUT_PADDING_HORIZONTAL,
                height: overlayHeight
              }
            ]}
            onPress={() => onImagePress(block)}
            accessibilityRole="button"
            accessibilityLabel={block.alt || block.src}
          >
            <View style={[styles.overlayMask, { backgroundColor }]}>
              <NativeMarkdownImage
                rawSrc={block.src}
                alt={block.alt}
                imageStyle={styles.inlineImage}
                syncUri={resolveImageUri?.(block.src) ?? null}
                loadImageUri={loadImageUri}
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 2
  },
  overlayItem: {
    position: 'absolute'
  },
  overlayMask: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden'
  },
  inlineImage: {
    width: '100%',
    height: DIARY_INLINE_IMAGE_PREVIEW_HEIGHT,
    borderRadius: 8
  }
})
