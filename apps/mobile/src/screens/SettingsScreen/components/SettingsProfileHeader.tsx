import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Camera, Images, LayoutGrid } from 'lucide-react-native'
import {
  useNativeTheme,
  useDialog,
  useNativeToast,
  resolveNativeUserAvatarSource,
  launchAvatarImageLibraryAsync,
  requestAvatarLibraryPermission,
  runAfterOverlayDismiss,
  Modal,
  NATIVE_BUILTIN_USER_AVATAR_SOURCES
} from '@baishou/ui/native'
import {
  type UserGender,
  BUILTIN_USER_AVATAR_IDS,
  type BuiltinUserAvatarId,
  parseBuiltinUserAvatarId,
  toBuiltinUserAvatarPath,
  isCustomUserAvatar
} from '@baishou/shared'
import { useResolvedUserAvatar } from '../../../hooks/useResolvedUserAvatar'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { SettingsProfileModal, type SettingsProfileSavePayload } from './SettingsProfileModal'

export type { SettingsProfileSavePayload }
export { SettingsProfileModal }

export interface SettingsProfileHeaderProps {
  profile: {
    nickname: string
    birthday?: string | null
    gender?: UserGender | null
    customGender?: string | null
    avatarPath?: string | null
    showIdentityInProfile?: boolean
    shareIdentityWithCompanion?: boolean
  }
  onSave: (data: SettingsProfileSavePayload) => Promise<void>
  /** 数据库未就绪时仍可展示，仅禁用保存 */
  disabled?: boolean
  /** 嵌入个人资料分组卡片内 */
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
  const { uri: resolvedAvatarUri, resolving: avatarResolving } = useResolvedUserAvatar(
    profile.avatarPath
  )
  const [pendingPreviewUri, setPendingPreviewUri] = useState<string | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [builtinModalOpen, setBuiltinModalOpen] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)

  const selectedBuiltinId = parseBuiltinUserAvatarId(profile.avatarPath)

  const handleSelectBuiltin = (id: BuiltinUserAvatarId) => {
    setBuiltinModalOpen(false)
    void onSave({
      ...profile,
      avatarPath: toBuiltinUserAvatarPath(id)
    })
  }

  useEffect(() => {
    if (!pendingPreviewUri) return
    if (resolvedAvatarUri && profile.avatarPath?.startsWith('avatars/')) {
      setPendingPreviewUri(null)
    }
  }, [pendingPreviewUri, resolvedAvatarUri, profile.avatarPath])

  const displayName = profile.nickname?.trim() || t('profile.default_nickname', '白守用户')
  const displayUri = pendingPreviewUri ?? resolvedAvatarUri
  const showAvatarSpinner = avatarResolving && !displayUri && !savingAvatar
  const avatarSource = displayUri
    ? ({ uri: displayUri } as const)
    : showAvatarSpinner
      ? null
      : resolveNativeUserAvatarSource(profile.avatarPath, displayUri)

  const genderLabel =
    profile.gender && profile.gender !== 'unspecified'
      ? profile.gender === 'other' && profile.customGender?.trim()
        ? profile.customGender.trim()
        : t(
            `graph.awaken_gender_${profile.gender}`,
            profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '自定义'
          )
      : ''
  const showIdentity = profile.showIdentityInProfile !== false
  const identitySubtitle = showIdentity
    ? [profile.birthday, genderLabel].filter(Boolean).join(' · ')
    : ''

  const pickAvatarFromLibrary = async () => {
    if (disabled || savingAvatar) return
    try {
      if (!(await requestAvatarLibraryPermission())) {
        toast.showError(t('profile.image_pick_permission', '需要相册权限才能选择图片'))
        return
      }

      const result = await launchAvatarImageLibraryAsync()
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setPendingPreviewUri(asset.uri)
        setSavingAvatar(true)
        try {
          await onSave({
            ...profile,
            avatarPath: asset.uri,
            avatarSourceByteSize: asset.fileSize ?? undefined
          })
        } finally {
          setSavingAvatar(false)
        }
      }
    } catch {
      setPendingPreviewUri(null)
      setSavingAvatar(false)
      toast.showError(t('profile.image_pick_error', '选择图片失败'))
    }
  }

  const handlePickImage = () => {
    if (disabled || savingAvatar) return
    void dialog
      .choose(t('profile.change_avatar', '更换头像'), [
        {
          label: t('profile.select_builtin_avatar', '选择内置头像'),
          value: 'builtin',
          leading: <LayoutGrid size={20} color={colors.primary} strokeWidth={2} />
        },
        {
          label: t('profile.pick_from_library', '从相册选择'),
          value: 'library',
          leading: <Images size={20} color={colors.primary} strokeWidth={2} />
        }
      ])
      .then((choice) => {
        if (choice === 'builtin') {
          runAfterOverlayDismiss(() => setBuiltinModalOpen(true))
        } else if (choice === 'library') {
          runAfterOverlayDismiss(() => void pickAvatarFromLibrary())
        }
      })
  }

  const handleOpenEdit = () => {
    if (disabled) return
    setModalVisible(true)
  }

  return (
    <>
      <View
        style={[
          styles.row,
          embedded && [styles.rowDivider, { borderBottomColor: colors.borderSubtle }],
          embedded && { backgroundColor: 'transparent' }
        ]}
      >
        <Pressable
          onPress={handlePickImage}
          disabled={disabled || savingAvatar}
          style={({ pressed }) => [styles.avatarBtn, pressed && !disabled && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.change_avatar', '更换头像')}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImage} />
            ) : (
              <ActivityIndicator size="small" color={colors.primary} />
            )}
            {savingAvatar ? (
              <View style={[styles.avatarSavingOverlay, { backgroundColor: colors.bgOverlay }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
            <Camera size={12} color={colors.textOnPrimary} strokeWidth={2} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.meta, pressed && !disabled && { opacity: 0.75 }]}
          onPress={handleOpenEdit}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t('profile.identity_title', '身份资料')}
        >
          <Text style={[styles.nickname, { color: colors.textPrimary }]} numberOfLines={1}>
            {displayName}
          </Text>
          {showIdentity ? (
            <Text
              style={[
                styles.subtitle,
                { color: identitySubtitle ? colors.textSecondary : colors.textTertiary }
              ]}
              numberOfLines={1}
            >
              {identitySubtitle ||
                t('profile.identity_complete_prompt', '完善生日、性别等身份资料 ›')}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={handleOpenEdit}
          disabled={disabled}
          style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={t('profile.identity_title', '身份资料')}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 18 }}>›</Text>
        </Pressable>
      </View>

      <SettingsProfileModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        profile={profile}
        onSave={onSave}
        disabled={disabled}
      />

      <Modal
        visible={builtinModalOpen}
        title={t('profile.builtin_avatars', '内置头像')}
        onClose={() => setBuiltinModalOpen(false)}
      >
        <ScrollView contentContainerStyle={styles.modalGrid} showsVerticalScrollIndicator={false}>
          {BUILTIN_USER_AVATAR_IDS.map((id) => {
            const selected = selectedBuiltinId === id && !isCustomUserAvatar(profile.avatarPath)
            return (
              <Pressable
                key={id}
                onPress={() => handleSelectBuiltin(id)}
                style={[
                  styles.presetBtn,
                  {
                    borderColor: selected ? colors.primary : colors.borderSubtle,
                    borderRadius: sharedTokens.radius.md,
                    backgroundColor: colors.bgSurface
                  },
                  selected && { borderWidth: 2 }
                ]}
              >
                <Image source={NATIVE_BUILTIN_USER_AVATAR_SOURCES[id]} style={styles.presetImg} />
              </Pressable>
            )
          })}
        </ScrollView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.mdPlus,
    gap: sharedTokens.spacing.mdSnug
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  avatarBtn: {
    position: 'relative'
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 56,
    height: 56
  },
  avatarSavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
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
    flex: 1,
    gap: 3
  },
  nickname: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sharedTokens.spacing.smPlus,
    justifyContent: 'center',
    paddingBottom: sharedTokens.spacing.xs
  },
  presetBtn: {
    width: 72,
    height: 72,
    borderWidth: 1,
    overflow: 'hidden'
  },
  presetImg: {
    width: '100%',
    height: '100%'
  }
})
