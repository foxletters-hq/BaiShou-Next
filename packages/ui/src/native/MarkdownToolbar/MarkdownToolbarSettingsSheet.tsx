import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal, useWindowDimensions } from 'react-native'
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams
} from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { GripVertical } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { MARKDOWN_TOOLBAR_TOOL_META, type MarkdownToolbarToolId } from './markdown-toolbar.types'

interface MarkdownToolbarSettingsSheetProps {
  visible: boolean
  toolOrder: MarkdownToolbarToolId[]
  onClose: () => void
  onSave: (order: MarkdownToolbarToolId[]) => void
}

const ROW_HEIGHT = 56
const HEADER_HEIGHT = 92
const FOOTER_HEIGHT = 68

export const MarkdownToolbarSettingsSheet: React.FC<MarkdownToolbarSettingsSheetProps> = ({
  visible,
  toolOrder,
  onClose,
  onSave
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [draftOrder, setDraftOrder] = useState(toolOrder)

  const cardWidth = Math.min(screenWidth - 32, 480)
  const listHeight = Math.min(screenHeight * 0.52, draftOrder.length * ROW_HEIGHT + 24)
  const cardHeight = HEADER_HEIGHT + listHeight + FOOTER_HEIGHT

  useEffect(() => {
    if (visible) setDraftOrder(toolOrder)
  }, [visible, toolOrder])

  const handleSave = useCallback(() => {
    onSave(draftOrder)
    onClose()
  }, [draftOrder, onClose, onSave])

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<MarkdownToolbarToolId>) => {
      const meta = MARKDOWN_TOOLBAR_TOOL_META[item]
      const label = t(meta.labelKey, meta.labelDefault)

      return (
        <ScaleDecorator>
          <TouchableOpacity
            onLongPress={drag}
            disabled={isActive}
            delayLongPress={120}
            activeOpacity={0.85}
            style={[
              styles.row,
              {
                backgroundColor: isActive ? colors.bgApp : colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <GripVertical
              size={22}
              color={colors.textTertiary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
          </TouchableOpacity>
        </ScaleDecorator>
      )
    },
    [colors, t]
  )

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.overlay, { backgroundColor: colors.bgOverlay }]}>
          <View
            style={[
              styles.card,
              {
                width: cardWidth,
                height: cardHeight,
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('diary.toolbar_settings_title', '工具栏排序')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('diary.toolbar_settings_hint', '长按拖动以调整工具顺序')}
              </Text>
            </View>

            <DraggableFlatList
              data={draftOrder}
              keyExtractor={(item) => item}
              renderItem={renderItem}
              onDragEnd={({ data }) => setDraftOrder(data)}
              style={{ height: listHeight }}
              containerStyle={{ height: listHeight }}
              contentContainerStyle={styles.listContent}
              activationDistance={12}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />

            <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
              <TouchableOpacity
                style={[styles.footerBtn, { borderColor: colors.borderSubtle }]}
                onPress={onClose}
                activeOpacity={0.75}
              >
                <Text style={{ color: colors.textSecondary }}>{t('common.cancel', '取消')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.footerBtn, styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                activeOpacity={0.75}
              >
                <Text style={{ color: colors.textOnPrimary }}>{t('common.save', '保存')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden'
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6
  },
  title: {
    fontSize: 18,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  footerBtn: {
    minWidth: 88,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  saveBtn: {
    borderWidth: 0
  }
})
