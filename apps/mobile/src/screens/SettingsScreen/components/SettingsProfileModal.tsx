import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  useNativeTheme,
  useNativeToast,
  FloatingModal,
  Input,
  Button,
  modalActionsStyle,
  Switch,
  BirthdayPickerField
} from '@baishou/ui/native'
import { USER_GENDER_OPTIONS, isDefaultGraphSelfName, type UserGender } from '@baishou/shared'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export interface SettingsProfileSavePayload {
  nickname: string
  birthday?: string | null
  gender?: UserGender | null
  customGender?: string | null
  avatarPath?: string | null
  /** ImagePicker 提供的原图体积，避免为测大小重复读取 content:// */
  avatarSourceByteSize?: number
  showIdentityInProfile?: boolean
  shareIdentityWithCompanion?: boolean
}

export interface SettingsProfileModalProps {
  visible: boolean
  onClose: () => void
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
  disabled?: boolean
}

/** 身份资料设置弹窗，复用于设置页顶部卡片和记忆整理身份唤醒 */
export const SettingsProfileModal: React.FC<SettingsProfileModalProps> = ({
  visible,
  onClose,
  profile,
  onSave,
  disabled = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()

  const resolveInitialNickname = (nickname: string | null | undefined) => {
    const raw = nickname?.trim() || ''
    return isDefaultGraphSelfName(raw) ? '' : raw
  }

  const [formNickname, setFormNickname] = useState(resolveInitialNickname(profile.nickname))
  const [formBirthday, setFormBirthday] = useState(profile.birthday || '')
  const [formGender, setFormGender] = useState<UserGender | ''>(profile.gender || '')
  const [formCustomGender, setFormCustomGender] = useState(profile.customGender || '')
  const [formShowIdentity, setFormShowIdentity] = useState(profile.showIdentityInProfile !== false)
  const [formShareWithCompanion, setFormShareWithCompanion] = useState(
    profile.shareIdentityWithCompanion !== false
  )
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    if (visible) {
      setFormNickname(resolveInitialNickname(profile.nickname))
      setFormBirthday(profile.birthday || '')
      setFormGender(profile.gender || '')
      setFormCustomGender(profile.customGender || '')
      setFormShowIdentity(profile.showIdentityInProfile !== false)
      setFormShareWithCompanion(profile.shareIdentityWithCompanion !== false)
    }
  }, [
    visible,
    profile.nickname,
    profile.birthday,
    profile.gender,
    profile.customGender,
    profile.showIdentityInProfile,
    profile.shareIdentityWithCompanion
  ])

  const handleSaveModal = async () => {
    if (disabled || savingProfile) return
    const trimmedName = formNickname.trim()
    if (!trimmedName) {
      toast.showError(t('profile.nickname_empty_error', '请输入昵称'))
      return
    }
    if (isDefaultGraphSelfName(trimmedName)) {
      toast.showError(t('profile.nickname_default_error', '请设置您的专属称呼（不能为默认昵称）'))
      return
    }
    setSavingProfile(true)
    try {
      await onSave({
        ...profile,
        nickname: trimmedName,
        birthday: formBirthday.trim() || null,
        gender: formGender || null,
        customGender: formGender === 'other' ? formCustomGender.trim() || null : null,
        showIdentityInProfile: formShowIdentity,
        shareIdentityWithCompanion: formShareWithCompanion
      })
      onClose()
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <FloatingModal
      visible={visible}
      onClose={onClose}
      maxWidth={440}
      cardStyle={{ padding: sharedTokens.spacing.lg }}
    >
      <View style={{ gap: sharedTokens.spacing.md }}>
        <Text
          style={{
            fontSize: mobileTypography.title.fontSize,
            fontWeight: '600',
            color: colors.textPrimary
          }}
        >
          {t('profile.identity_title', '身份资料')}
        </Text>

        <View style={{ gap: sharedTokens.spacing.sm }}>
          <Input
            label={t('profile.nickname_label', '昵称')}
            value={formNickname}
            onChangeText={setFormNickname}
            placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
            autoCapitalize="none"
          />

          <BirthdayPickerField
            label={t('profile.birthday_label', '生日')}
            value={formBirthday}
            onChange={setFormBirthday}
            placeholder={t('profile.birthday_placeholder', '选择你的生日（选填）')}
          />

          <View style={{ gap: sharedTokens.spacing.xs }}>
            <Text
              style={{
                fontSize: mobileTypography.secondary.fontSize,
                fontWeight: '600',
                color: colors.textSecondary
              }}
            >
              {t('profile.gender_label', '性别')}
            </Text>
            <View style={{ flexDirection: 'row', gap: sharedTokens.spacing.xs, flexWrap: 'wrap' }}>
              {USER_GENDER_OPTIONS.map((g) => {
                const active = formGender === g
                return (
                  <Pressable
                    key={g}
                    onPress={() => setFormGender(g)}
                    style={{
                      paddingHorizontal: sharedTokens.spacing.md,
                      paddingVertical: sharedTokens.spacing.xsPlus,
                      borderRadius: sharedTokens.radius.md,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.borderControl,
                      backgroundColor: active ? colors.primary : colors.bgSurface
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.textOnPrimary : colors.textPrimary,
                        fontSize: mobileTypography.secondary.fontSize,
                        fontWeight: active ? '600' : '400'
                      }}
                    >
                      {t(
                        `graph.awaken_gender_${g}`,
                        g === 'male'
                          ? '男'
                          : g === 'female'
                            ? '女'
                            : g === 'other'
                              ? '自定义'
                              : '暂不设置'
                      )}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {formGender === 'other' ? (
              <View style={{ marginTop: sharedTokens.spacing.xxs }}>
                <Input
                  value={formCustomGender}
                  onChangeText={setFormCustomGender}
                  placeholder={t('profile.custom_gender_placeholder', '输入自定义性别')}
                  autoCapitalize="none"
                />
              </View>
            ) : null}
          </View>

          <View
            style={{
              marginTop: sharedTokens.spacing.xs,
              paddingTop: sharedTokens.spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.borderSubtle,
              gap: sharedTokens.spacing.md
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: sharedTokens.spacing.md
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: '500',
                    color: colors.textPrimary
                  }}
                >
                  {t('profile.show_identity_in_profile', '在资料卡展示生日与性别')}
                </Text>
                <Text
                  style={{
                    fontSize: mobileTypography.caption.fontSize,
                    color: colors.textTertiary,
                    marginTop: 2
                  }}
                >
                  {t(
                    'profile.show_identity_in_profile_hint',
                    '关闭后个人资料主卡片不再显示生日和性别'
                  )}
                </Text>
              </View>
              <Switch value={formShowIdentity} onValueChange={setFormShowIdentity} />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: sharedTokens.spacing.md
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: mobileTypography.secondary.fontSize,
                    fontWeight: '500',
                    color: colors.textPrimary
                  }}
                >
                  {t('profile.share_identity_with_companion', '与 AI 伙伴对话时同步生日与性别')}
                </Text>
                <Text
                  style={{
                    fontSize: mobileTypography.caption.fontSize,
                    color: colors.textTertiary,
                    marginTop: 2
                  }}
                >
                  {t(
                    'profile.share_identity_with_companion_hint',
                    '开启后伙伴将知晓你的生日与性别'
                  )}
                </Text>
              </View>
              <Switch value={formShareWithCompanion} onValueChange={setFormShareWithCompanion} />
            </View>
          </View>
        </View>

        <View style={modalActionsStyle}>
          <Button size="sm" variant="ghost" onPress={onClose} disabled={savingProfile}>
            {t('common.cancel', '取消')}
          </Button>
          <Button size="sm" onPress={handleSaveModal} isLoading={savingProfile}>
            {t('common.save', '保存')}
          </Button>
        </View>
      </View>
    </FloatingModal>
  )
}
