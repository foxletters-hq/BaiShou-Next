import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import type { MockChatAttachment } from '@baishou/shared'
import { useNativeTheme } from '../theme'

export type NativeChatAttachmentDisplay = 'thumb' | 'sticker'

interface NativeChatBubbleAttachmentsProps {
  attachments: MockChatAttachment[]
  isUserBubble?: boolean
  display?: NativeChatAttachmentDisplay
  placement?: 'before' | 'after'
}

export const NativeChatBubbleAttachments: React.FC<NativeChatBubbleAttachmentsProps> = ({
  attachments,
  isUserBubble = false,
  display = 'thumb',
  placement = 'before'
}) => {
  const { colors } = useNativeTheme()
  const isSticker = display === 'sticker'

  if (!attachments.length) return null

  return (
    <View
      style={[
        styles.wrap,
        isUserBubble ? styles.wrapUser : styles.wrapAssistant,
        placement === 'after' ? styles.wrapAfter : null
      ]}
    >
      {attachments.map((att, index) => (
        <View key={`${att.id}-${index}`} style={styles.item}>
          {att.isImage ? (
            <Image
              source={{ uri: att.filePath }}
              style={[
                isSticker ? styles.stickerImage : styles.image,
                isSticker ? null : { backgroundColor: colors.bgSurfaceHigh }
              ]}
              resizeMode={isSticker ? 'contain' : 'cover'}
              accessibilityLabel={att.fileName}
            />
          ) : (
            <View
              style={[
                styles.document,
                {
                  backgroundColor: colors.bgSurfaceHigh,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <Text style={styles.docIcon}>{att.isPdf || att.isText ? '📄' : '📁'}</Text>
              <Text style={[styles.docName, { color: colors.textPrimary }]} numberOfLines={2}>
                {att.fileName}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8
  },
  wrapAfter: {
    marginTop: 8,
    marginBottom: 0
  },
  wrapUser: {
    justifyContent: 'flex-end'
  },
  wrapAssistant: {
    justifyContent: 'flex-start'
  },
  item: {
    flexShrink: 0
  },
  image: {
    width: 160,
    height: 160,
    borderRadius: 8
  },
  stickerImage: {
    width: 280,
    height: 280,
    maxWidth: '100%',
    borderRadius: 12
  },
  document: {
    width: 160,
    padding: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  docIcon: {
    fontSize: 24
  },
  docName: {
    flex: 1,
    fontSize: 12
  }
})
