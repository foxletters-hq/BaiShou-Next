import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import type { MockChatAttachment } from '@baishou/shared'
import { useNativeTheme } from '../theme'

interface NativeChatBubbleAttachmentsProps {
  attachments: MockChatAttachment[]
  isUserBubble?: boolean
}

export const NativeChatBubbleAttachments: React.FC<NativeChatBubbleAttachmentsProps> = ({
  attachments,
  isUserBubble = false
}) => {
  const { colors } = useNativeTheme()

  if (!attachments.length) return null

  return (
    <View style={[styles.wrap, isUserBubble ? styles.wrapUser : styles.wrapAssistant]}>
      {attachments.map((att, index) => (
        <View key={`${att.id}-${index}`} style={styles.item}>
          {att.isImage ? (
            <Image
              source={{ uri: att.filePath }}
              style={[styles.image, { backgroundColor: colors.bgSurfaceHigh }]}
              resizeMode="cover"
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
