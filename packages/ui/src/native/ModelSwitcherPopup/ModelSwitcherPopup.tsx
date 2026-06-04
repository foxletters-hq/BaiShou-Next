import React from 'react'
import { View, Text, Pressable, FlatList, Modal, SafeAreaView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface ModelSwitcherPopupProps {
  visible: boolean
  onClose: () => void
  models: Array<{ id: string; name: string; providerId: string }>
  selectedModelId: string
  onSelect: (modelId: string) => void
}

export const ModelSwitcherPopup: React.FC<ModelSwitcherPopupProps> = ({
  visible,
  onClose,
  models,
  selectedModelId,
  onSelect
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()

  if (!visible) return null

  const renderItem = ({ item }: { item: { id: string; name: string; providerId: string } }) => {
    const isSelected = item.id === selectedModelId
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
        <View style={styles.itemContent}>
          <Text style={[styles.providerLabel, { color: colors.textTertiary }]}>
            {item.providerId}
          </Text>
          <Text
            style={[
              styles.modelName,
              { color: isSelected ? colors.onPrimaryContainer : colors.textPrimary }
            ]}
          >
            {item.name}
          </Text>
        </View>
        {isSelected && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
      </Pressable>
    )
  }

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
                <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                  {t('model.switch', '切换模型')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
            </View>

            <FlatList
              data={models}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={[styles.emptyContainer, { padding: tokens.spacing.lg }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('model.noModels', '暂无可用模型')}
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
  itemContent: {
    flex: 1
  },
  providerLabel: {
    fontSize: 12,
    marginBottom: 2
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 16
  }
})
