import React from 'react'
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import type { DiaryEditorViewMode } from '../DiaryEditor/diary-editor.types'

interface MarkdownToolbarProps {
  viewMode: DiaryEditorViewMode
  onViewModeChange: (mode: DiaryEditorViewMode) => void
  onHideKeyboard: () => void
  onInsertText: (prefix: string, suffix?: string) => void
  onPickImages?: () => void
  pickingImages?: boolean
  /** 光标位于图片 Markdown 上时显示缩放工具（与格式工具同排） */
  showImageTools?: boolean
  onImageZoomIn?: () => void
  onImageZoomOut?: () => void
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  viewMode,
  onViewModeChange,
  onHideKeyboard,
  onInsertText,
  onPickImages,
  pickingImages = false,
  showImageTools = false,
  onImageZoomIn,
  onImageZoomOut
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderTopColor: colors.borderSubtle
        }
      ]}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.toolRow}>
          {showImageTools && (
            <>
              <TouchableOpacity
                style={styles.btn}
                onPress={onImageZoomIn}
                accessibilityLabel={t('image_preview.zoom_in', 'Zoom in')}
              >
                <MaterialIcons name="zoom-in" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
                onPress={onImageZoomOut}
                accessibilityLabel={t('image_preview.zoom_out', 'Zoom out')}
              >
                <MaterialIcons name="zoom-out" size={20} color={colors.primary} />
              </TouchableOpacity>
              <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />
            </>
          )}

          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('**', '**')}>
            <Text style={[styles.btnText, { color: colors.textSecondary, fontWeight: 'bold' }]}>
              B
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('*', '*')}>
            <Text style={[styles.btnText, { color: colors.textSecondary, fontStyle: 'italic' }]}>
              I
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('## ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>H</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('- ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>≡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('- [ ] ')}>
            <Text style={[styles.btnText, { color: colors.textSecondary }]}>☑</Text>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <TouchableOpacity style={styles.btn} onPressIn={() => onInsertText('[', '](url)')}>
            <MaterialIcons name="link" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={onPickImages}
            disabled={!onPickImages || pickingImages}
          >
            {pickingImages ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="image" size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.actions, { borderLeftColor: colors.borderSubtle }]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onViewModeChange('edit')}
          accessibilityLabel={t('diary.mode_edit')}
        >
          <MaterialIcons
            name="edit"
            size={22}
            color={viewMode === 'edit' ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => onViewModeChange('preview')}
          accessibilityLabel={t('diary.mode_preview')}
        >
          <MaterialIcons
            name="menu-book"
            size={22}
            color={viewMode === 'preview' ? colors.primary : colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onHideKeyboard}>
          <MaterialIcons name="keyboard-hide" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8
  },
  scroll: {
    flex: 1
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnText: {
    fontSize: 16
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 1,
    paddingLeft: 4,
    gap: 0
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  }
})
