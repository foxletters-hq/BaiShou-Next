import React from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'

interface MarkdownToolbarProps {
  onInsertText: (prefix: string, suffix?: string) => void
  onPickImages?: () => void
  pickingImages?: boolean
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onInsertText,
  onPickImages,
  pickingImages = false
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
      <TouchableOpacity
        style={[styles.btn, { borderColor: colors.borderSubtle }]}
        onPressIn={() => onInsertText('#')}
        accessibilityLabel={t('diary.toolbar_insert_tag', '插入标签')}
      >
        <Text style={[styles.hashText, { color: colors.primary }]}>#</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { borderColor: colors.borderSubtle }]}
        onPressIn={() => onInsertText('##### ')}
        accessibilityLabel={t('diary.toolbar_insert_h5', '插入五级标题')}
      >
        <Text style={[styles.labelText, { color: colors.textSecondary }]}>H5</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { borderColor: colors.borderSubtle }]}
        onPressIn={() => onInsertText('###### ')}
        accessibilityLabel={t('diary.toolbar_insert_h6', '插入六级标题')}
      >
        <Text style={[styles.labelText, { color: colors.textSecondary }]}>H6</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { borderColor: colors.borderSubtle }]}
        onPress={onPickImages}
        disabled={!onPickImages || pickingImages}
        accessibilityLabel={t('diary.toolbar_insert_image', '插入图片')}
      >
        {pickingImages ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialIcons
            name="image"
            size={22}
            color={onPickImages ? colors.textSecondary : colors.textTertiary}
          />
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 24
  },
  btn: {
    minWidth: 52,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12
  },
  hashText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24
  },
  labelText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3
  }
})
