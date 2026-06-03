import React from 'react'
import { View, Text, Pressable, Image, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { useNativeTheme, useDialog, useNativeToast } from '@baishou/ui/native'

const DEFAULT_AVATAR = require('@baishou/shared/assets/images/icon.png')

export interface SettingsProfileHeaderProps {
  profile: { nickname: string; avatarPath?: string | null }
  onSave: (data: { nickname: string; avatarPath?: string | null }) => void
  /** 数据库未就绪时仍可展示，仅禁用保存 */
  disabled?: boolean
  /** 嵌入快捷设置分组卡片内 */
  embedded?: boolean
}

export const SettingsProfileHeader: React.FC<SettingsProfileHeaderProps> = ({
  profile,
  onSave,
  disabled = false,
  embedded = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()

  const displayName = profile.nickname?.trim() || t('profile.default_nickname', '白守用户')

  const handlePickImage = async () => {
    if (disabled) return
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8
      })
      if (!result.canceled && result.assets[0]) {
        onSave({ ...profile, avatarPath: result.assets[0].uri })
      }
    } catch {
      toast.showError(t('profile.image_pick_error', '选择图片失败'))
    }
  }

  const handleEditNickname = async () => {
    if (disabled) return
    const nextName = await dialog.prompt(
      t('profile.edit_nickname_prompt', '请输入新的昵称：'),
      profile.nickname
    )
    if (nextName && nextName.trim() !== '' && nextName !== profile.nickname) {
      onSave({ ...profile, nickname: nextName.trim() })
    }
  }

  return (
    <View
      style={[
        styles.row,
        embedded && [
          styles.rowDivider,
          { borderBottomColor: colors.borderSubtle }
        ],
        embedded && { backgroundColor: 'transparent' }
      ]}
    >
      <Pressable
        onPress={handlePickImage}
        disabled={disabled}
        style={({ pressed }) => [styles.avatarBtn, pressed && !disabled && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={t('profile.change_avatar', '更换头像')}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
          {profile.avatarPath ? (
            <Image source={{ uri: profile.avatarPath }} style={styles.avatarImage} />
          ) : (
            <Image source={DEFAULT_AVATAR} style={styles.avatarImage} />
          )}
        </View>
        <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="photo-camera" size={12} color={colors.textOnPrimary} />
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.meta, pressed && !disabled && { opacity: 0.75 }]}
        onPress={handleEditNickname}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('profile.edit_nickname', '修改昵称')}
      >
        <Text style={[styles.nickname, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayName}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  avatarBtn: {
    position: 'relative'
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 52,
    height: 52
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  meta: {
    flex: 1
  },
  nickname: {
    fontSize: 17,
    fontWeight: '600'
  }
})
