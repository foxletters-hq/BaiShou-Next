import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { DatePickerFloatingModal, Input, useNativeTheme } from '@baishou/ui/native'
import { formatLocalDate, USER_GENDERS, type UserGender } from '@baishou/shared'
import { ONBOARDING_PAGE, SLIDE_THEMES } from '../onboarding-theme'
import { OnboardingGlowIcon } from './OnboardingGlowIcon'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export type OnboardingProfileSlideProps = {
  nickname: string
  onChangeNickname: (value: string) => void
  nicknameError?: boolean
  birthday: string
  onChangeBirthday: (value: string) => void
  gender: UserGender | null
  onChangeGender: (value: UserGender | null) => void
  customGender?: string
  onChangeCustomGender?: (value: string) => void
}

export const OnboardingProfileSlide: React.FC<OnboardingProfileSlideProps> = ({
  nickname,
  onChangeNickname,
  nicknameError = false,
  birthday,
  onChangeBirthday,
  gender,
  onChangeGender,
  customGender = '',
  onChangeCustomGender
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false)

  const hasValidBirthday = useMemo(() => /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim()), [birthday])

  const birthdayDate = useMemo(() => {
    const raw = birthday.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date()
    }
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [birthday])

  const birthdayLabel = useMemo(() => {
    if (!hasValidBirthday) {
      return t('onboarding.birthday_placeholder', '选择你的生日（选填）')
    }
    const [y, m, d] = birthday.trim().split('-').map(Number)
    return t('graph.awaken_birthday_value', '{{year}}年{{month}}月{{day}}日', {
      year: y,
      month: m,
      day: d
    })
  }, [birthday, hasValidBirthday, t])

  const maxBirthday = useMemo(() => new Date(), [])
  const minBirthday = useMemo(() => new Date(1900, 0, 1), [])

  return (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PROFILE]} />
      <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>
        {t('onboarding.profile_title', '让伙伴认识你')}
      </Text>

      <View style={styles.formContainer}>
        <View style={styles.fieldGroup}>
          <View style={styles.labelRow}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {t('onboarding.nickname_label', '你的名字')}
            </Text>
            <Text style={[styles.requiredMark, { color: colors.error }]}>*</Text>
          </View>
          <Input
            value={nickname}
            onChangeText={onChangeNickname}
            placeholder={t('onboarding.nickname_placeholder', '怎么称呼你？')}
            error={
              nicknameError ? t('onboarding.nickname_required', '请告诉伙伴你的名字吧~') : undefined
            }
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('onboarding.birthday_label', '你的生日')}
          </Text>
          <Pressable
            onPress={() => setBirthdayPickerOpen(true)}
            style={[
              styles.birthdayTrigger,
              {
                borderColor: colors.borderControl,
                backgroundColor: colors.bgSurface
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.birthday_label', '你的生日')}
          >
            <Text
              style={[
                styles.birthdayText,
                {
                  color: hasValidBirthday ? colors.textPrimary : colors.textTertiary
                }
              ]}
              numberOfLines={1}
            >
              {birthdayLabel}
            </Text>
            <View style={styles.birthdayTrailing}>
              {hasValidBirthday ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation()
                    onChangeBirthday('')
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.clear', '清除')}
                >
                  <Text style={[styles.clearIcon, { color: colors.textTertiary }]}>✕</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.chevronIcon, { color: colors.textTertiary }]}>▼</Text>
            </View>
          </Pressable>
          <DatePickerFloatingModal
            visible={birthdayPickerOpen}
            value={birthdayDate}
            minDate={minBirthday}
            maxDate={maxBirthday}
            onClose={() => setBirthdayPickerOpen(false)}
            onConfirm={(date) => {
              onChangeBirthday(formatLocalDate(date))
              setBirthdayPickerOpen(false)
            }}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            {t('onboarding.gender_label', '你的性别')}
          </Text>
          <View style={styles.genderRow}>
            {USER_GENDERS.map((g) => {
              const active = gender === g
              return (
                <Pressable
                  key={g}
                  onPress={() => onChangeGender(gender === g ? null : g)}
                  style={[
                    styles.genderChip,
                    {
                      borderColor: active ? colors.primary : colors.borderControl,
                      backgroundColor: active ? colors.primary : colors.bgSurface
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      {
                        color: active ? colors.textOnPrimary : colors.textPrimary,
                        fontWeight: active ? '600' : '400'
                      }
                    ]}
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
          {gender === 'other' && onChangeCustomGender ? (
            <View style={{ marginTop: sharedTokens.spacing.xxs }}>
              <Input
                value={customGender}
                onChangeText={onChangeCustomGender}
                placeholder={t(
                  'profile.custom_gender_placeholder',
                  '请输入自定义性别（如：沃尔玛购物袋、流体等）'
                )}
                autoCapitalize="none"
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slideInner: {
    alignItems: 'center',
    width: '100%'
  },
  slideTitle: {
    marginTop: sharedTokens.spacing.lg,
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 34
  },
  formContainer: {
    width: '100%',
    marginTop: sharedTokens.spacing.lg,
    gap: sharedTokens.spacing.mdTight
  },
  fieldGroup: {
    gap: sharedTokens.spacing.xs
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xxs
  },
  fieldLabel: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  requiredMark: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  birthdayTrigger: {
    minHeight: 44,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sharedTokens.spacing.sm
  },
  birthdayText: {
    flex: 1,
    fontSize: mobileTypography.body.fontSize
  },
  birthdayTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  clearIcon: {
    fontSize: mobileTypography.secondary.fontSize
  },
  chevronIcon: {
    fontSize: mobileTypography.caption.fontSize
  },
  genderRow: {
    flexDirection: 'row',
    gap: sharedTokens.spacing.xsPlus,
    flexWrap: 'wrap'
  },
  genderChip: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.xsPlus,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1
  },
  genderChipText: {
    fontSize: mobileTypography.secondary.fontSize
  }
})
