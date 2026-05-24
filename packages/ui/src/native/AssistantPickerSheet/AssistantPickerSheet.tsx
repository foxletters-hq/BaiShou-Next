import React from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Image
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AssistantPickerSheetProps {
  visible: boolean
  onClose: () => void
  assistants: Array<{ id: string; name: string; avatar?: string; providerId: string }>
  selectedId: string
  onSelect: (id: string) => void
}

export const AssistantPickerSheet: React.FC<AssistantPickerSheetProps> = ({
  visible,
  onClose,
  assistants,
  selectedId,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  if (!visible) return null

  const renderItem = ({
    item
  }: {
    item: { id: string; name: string; avatar?: string; providerId: string }
  }) => {
    const isSelected = item.id === selectedId
    return (
      <Pressable
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: isSelected
              ? colors.primaryContainer
              : pressed
                ? colors.bgSurfaceNormal
                : 'transparent',
            borderRadius: tokens.radius.md
          }
        ]}
        onPress={() => {
          onSelect(item.id)
          onClose()
        }}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.bgSurfaceNormal }
          ]}
        >
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarPlaceholder}>🤖</Text>
          )}
        </View>
        <View style={styles.itemText}>
          <Text
            style={[
              styles.itemName,
              { color: isSelected ? colors.onPrimaryContainer : colors.textPrimary }
            ]}
          >
            {item.name}
          </Text>
          <Text style={[styles.itemProvider, { color: colors.textTertiary }]}>
            {item.providerId}
          </Text>
        </View>
        {isSelected && (
          <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>
        )}
      </Pressable>
    )
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <SafeAreaView style={styles.safeArea}>
          <Pressable
            style={[
              styles.modalContent,
              {
                width: '90%',
                maxWidth: maxModalWidth,
                maxHeight: '75%',
                backgroundColor: colors.bgSurface,
                borderRadius: tokens.radius.xl,
                padding: tokens.spacing.lg
              }
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle}>
              <View
                style={[
                  styles.handleBar,
                  { backgroundColor: colors.borderSubtle }
                ]}
              />
            </View>

            <View style={styles.header}>
              <View style={[styles.headerTitleRow, { gap: tokens.spacing.sm }]}>
                <Text style={styles.headerIcon}>🤖</Text>
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('assistant.select', '选择助手')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            <FlatList
              data={assistants}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={[styles.emptyContainer, { padding: tokens.spacing.lg }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('assistant.noAssistants', '暂无助手')}
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
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16
  },
  modalContent: {},
  handle: {
    alignItems: 'center',
    marginBottom: 12
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2
  },
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarPlaceholder: {
    fontSize: 20
  },
  itemText: {
    flex: 1
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600'
  },
  itemProvider: {
    fontSize: 12,
    marginTop: 2
  },
  emptyContainer: {
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16
  }
})
