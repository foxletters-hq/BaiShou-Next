import React, { useMemo } from 'react'
import { View, Text, Pressable, FlatList, Modal, SafeAreaView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface EmojiPickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
  recentEmojis?: string[]
}

const commonEmojis = ['😊', '👋', '👍', '❤️', '🎉', '🔥', '⭐', '💡', '📝', '🎵', '🌈']

const allEmojis = [
  ...commonEmojis,
  '😀',
  '😂',
  '🤣',
  '😍',
  '😎',
  '🤩',
  '😇',
  '🙏',
  '💪',
  '✨',
  '🌟',
  '💫',
  '🎊',
  '🎁',
  '🏆',
  '🥇',
  '🍀',
  '🌺',
  '🌸',
  '🌻',
  '☀️',
  '🌙',
  '⚡',
  '💧',
  '🌊',
  '🌍',
  '🏠',
  '✈️',
  '🚀',
  '🎯',
  '📌',
  '✂️',
  '🔑',
  '💎',
  '🔔',
  '🎵',
  '🎶',
  '📚',
  '✏️',
  '💻',
  '📱',
  '🖥️',
  '⌨️',
  '🖱️',
  '📷',
  '🎬',
  '🎤',
  '🎧',
  '🎮',
  '🧩',
  '🍕',
  '🍔',
  '☕',
  '🍰',
  '🧠',
  '💬',
  '🗨️',
  '💭',
  '🔍',
  '📊'
]

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onClose,
  onSelect,
  recentEmojis = []
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  const displayRecent = useMemo(
    () => recentEmojis.filter((e) => e && e.trim()).slice(0, 8),
    [recentEmojis]
  )

  if (!visible) return null

  const numColumns = 8

  const renderEmoji = (emoji: string) => (
    <Pressable
      key={emoji}
      style={({ pressed }) => [
        styles.emojiCell,
        {
          backgroundColor: pressed ? colors.bgSurfaceNormal : 'transparent',
          borderRadius: tokens.radius.md
        }
      ]}
      onPress={() => {
        onSelect(emoji)
        onClose()
      }}
    >
      <Text style={styles.emojiText}>{emoji}</Text>
    </Pressable>
  )

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.modalContent,
              {
                width: '90%',
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <View style={[styles.headerTitleRow, { gap: tokens.spacing.sm }]}>
                <Text style={styles.headerIcon}>😊</Text>
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('emoji.picker', '选择表情')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            {/* Recent Section */}
            {displayRecent.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t('emoji.recent', '最近使用')}
                </Text>
                <View style={styles.emojiRow}>{displayRecent.map(renderEmoji)}</View>
              </View>
            )}

            {/* All Emojis */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {t('emoji.all', '全部表情')}
              </Text>
              <FlatList
                data={allEmojis}
                keyExtractor={(item, index) => `${item}-${index}`}
                numColumns={numColumns}
                renderItem={({ item }) => renderEmoji(item)}
                style={styles.emojiGrid}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center'
  },
  modalContent: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 20
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600'
  },
  closeIcon: {
    fontSize: 24
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  emojiGrid: {
    maxHeight: 250
  },
  emojiCell: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emojiText: {
    fontSize: 24
  }
})
