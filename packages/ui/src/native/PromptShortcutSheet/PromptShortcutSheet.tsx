import React from 'react'
import { View, Text, Pressable, FlatList, Modal, SafeAreaView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface PromptShortcutSheetProps {
  visible: boolean
  onClose: () => void
  shortcuts: Array<{ id: string; icon: string; name: string; content: string }>
  onSelect: (shortcut: { id: string; icon: string; name: string; content: string }) => void
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  visible,
  onClose,
  shortcuts,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  if (!visible) return null

  const renderItem = ({
    item
  }: {
    item: { id: string; icon: string; name: string; content: string }
  }) => (
    <Pressable
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed ? colors.bgSurfaceNormal : 'transparent',
          borderRadius: tokens.radius.md
        }
      ]}
      onPress={() => {
        onSelect(item)
        onClose()
      }}
    >
      <Text style={styles.itemIcon}>{item.icon}</Text>
      <View style={styles.itemText}>
        <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.itemContent, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.content}
        </Text>
      </View>
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
                maxHeight: '80%',
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.header}>
              <View style={[styles.headerTitleRow, { gap: tokens.spacing.sm }]}>
                <Text style={styles.headerIcon}>⚡</Text>
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('prompt.shortcuts', '提示词快捷指令')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            <FlatList
              data={shortcuts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={[styles.emptyContainer, { padding: tokens.spacing.lg }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('prompt.noShortcuts', '暂无快捷指令')}
                  </Text>
                </View>
              }
            />
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
  list: {
    maxHeight: 350
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4
  },
  itemIcon: {
    fontSize: 24,
    marginRight: 12
  },
  itemText: {
    flex: 1
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600'
  },
  itemContent: {
    fontSize: 13,
    marginTop: 2
  },
  emptyContainer: {
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16
  }
})
