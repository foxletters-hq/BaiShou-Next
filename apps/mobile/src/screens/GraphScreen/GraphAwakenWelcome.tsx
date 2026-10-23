import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  useWindowDimensions
} from 'react-native'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import {
  formatLocalDate,
  isDefaultGraphSelfName,
  USER_GENDER_OPTIONS,
  validateGraphAwakenForm,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
import { Button, DatePickerFloatingModal, Input, Select, useNativeTheme } from '@baishou/ui/native'

export type GraphAwakenSubmitPayload = {
  nickname: string
  birthday: string
  gender: UserGender
  customGender?: string | null
}

type Step = 'welcome' | 'profile'

function FadeSlideIn({ children, animKey }: { children: React.ReactNode; animKey: string }) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(12)).current

  useEffect(() => {
    opacity.setValue(0)
    translateY.setValue(12)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: sharedTokens.animation.moderate,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: sharedTokens.animation.moderate,
        useNativeDriver: true
      })
    ]).start()
  }, [animKey, opacity, translateY])

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
}

function AwakenAmbientGlow({ primary }: { primary: string }) {
  const { width, height } = useWindowDimensions()
  return (
    <View pointerEvents="none" style={styles.glowLayer}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="awakenGlowTop" cx="36%" cy="24%" r="58%">
            <Stop offset="0" stopColor={primary} stopOpacity="0.22" />
            <Stop offset="1" stopColor={primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="awakenGlowBottom" cx="82%" cy="88%" r="50%">
            <Stop offset="0" stopColor={primary} stopOpacity="0.12" />
            <Stop offset="1" stopColor={primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#awakenGlowTop)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#awakenGlowBottom)" />
      </Svg>
    </View>
  )
}

export function GraphAwakenWelcome(props: {
  initialProfile?: Pick<UserProfile, 'nickname' | 'birthday' | 'gender' | 'customGender'> | null
  busy?: boolean
  onSubmit: (payload: GraphAwakenSubmitPayload) => void | Promise<void>
}) {
  const { initialProfile, busy = false, onSubmit } = props
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [step, setStep] = useState<Step>('welcome')
  const initialNickname = useMemo(() => {
    const n = initialProfile?.nickname?.trim() ?? ''
    return isDefaultGraphSelfName(n) ? '' : n
  }, [initialProfile?.nickname])
  const [nickname, setNickname] = useState(initialNickname)
  const [birthday, setBirthday] = useState(initialProfile?.birthday?.trim() || '')
  const [gender, setGender] = useState<UserGender | ''>(
    (initialProfile?.gender as UserGender | undefined) || ''
  )
  const [customGender, setCustomGender] = useState(initialProfile?.customGender?.trim() || '')
  const [errors, setErrors] = useState<{
    nickname?: boolean
    birthday?: boolean
    gender?: boolean
  }>({})
  const [birthdayPickerOpen, setBirthdayPickerOpen] = useState(false)

  const birthdayDate = useMemo(() => {
    const raw = birthday.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return new Date()
    }
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d)
  }, [birthday])

  const birthdayLabel = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())) {
      return t('graph.awaken_birthday_placeholder', '选择你的生日')
    }
    const [y, m, d] = birthday.trim().split('-').map(Number)
    return t('graph.awaken_birthday_value', '{{year}}年{{month}}月{{day}}日', {
      year: y,
      month: m,
      day: d
    })
  }, [birthday, t])

  const fieldChrome = {
    ...styles.fieldControl,
    borderRadius: tokens.radius.md
  }
  const maxBirthday = useMemo(() => new Date(), [])
  const minBirthday = useMemo(() => new Date(1900, 0, 1), [])

  const genderLabel = (g: UserGender) => {
    switch (g) {
      case 'male':
        return t('graph.awaken_gender_male', '男')
      case 'female':
        return t('graph.awaken_gender_female', '女')
      case 'other':
        return t('graph.awaken_gender_other', '自定义')
      default:
        return t('graph.awaken_gender_unspecified', '暂不设置')
    }
  }

  const handleSubmit = async () => {
    const nextErrors = validateGraphAwakenForm({ nickname, birthday, gender, customGender })
    setErrors({
      nickname: !!nextErrors.nickname,
      birthday: !!nextErrors.birthday,
      gender: !!nextErrors.gender
    })
    if (Object.keys(nextErrors).length > 0) return
    await onSubmit({
      nickname: nickname.trim(),
      birthday: birthday.trim(),
      gender: gender as UserGender,
      customGender: gender === 'other' ? customGender.trim() || null : null
    })
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bgApp }]}>
      <AwakenAmbientGlow primary={colors.primary} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FadeSlideIn animKey={step}>
          {step === 'welcome' ? (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('graph.awaken_welcome_title', '唤醒你的人生关系图')}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {t(
                  'graph.awaken_welcome_body',
                  '从日记里整理出人与人的联结。先告诉我们「我」是谁，伙伴才能准确认出你。'
                )}
              </Text>
              <View style={{ alignSelf: 'flex-start', marginTop: tokens.spacing.sm }}>
                <Button
                  variant="outlined"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => setStep('profile')}
                >
                  {t('graph.awaken_welcome_cta', '唤醒人生关系图')}
                </Button>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('graph.awaken_form_title', '关于你')}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {t(
                  'graph.awaken_form_body',
                  '这些信息会写入你的身份资料，并用于图谱抽取时识别日记中的「我」。'
                )}
              </Text>

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('graph.awaken_nickname_label', '昵称')}
              </Text>
              <View
                style={[
                  fieldChrome,
                  {
                    borderColor: colors.borderControl,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              >
                <Input
                  bare
                  value={nickname}
                  onChangeText={setNickname}
                  editable={!busy}
                  placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
                  style={styles.nicknameInput}
                />
              </View>
              {errors.nickname ? (
                <Text style={[styles.error, { color: colors.error }]}>
                  {t('graph.awaken_nickname_required', '请填写昵称')}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('graph.awaken_birthday_label', '生日')}
              </Text>
              <Pressable
                disabled={busy}
                onPress={() => setBirthdayPickerOpen(true)}
                style={[
                  fieldChrome,
                  styles.fieldRow,
                  {
                    borderColor: errors.birthday ? colors.error : colors.borderControl,
                    backgroundColor: colors.bgSurface,
                    opacity: busy ? 0.55 : 1
                  }
                ]}
              >
                <Text
                  style={[
                    styles.fieldText,
                    {
                      color: /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())
                        ? colors.textPrimary
                        : colors.textSecondary
                    }
                  ]}
                  numberOfLines={1}
                >
                  {birthdayLabel}
                </Text>
                <Text style={[styles.fieldChevron, { color: colors.textTertiary }]}>▼</Text>
              </Pressable>
              <DatePickerFloatingModal
                visible={birthdayPickerOpen}
                value={birthdayDate}
                minDate={minBirthday}
                maxDate={maxBirthday}
                onClose={() => setBirthdayPickerOpen(false)}
                onConfirm={(date) => {
                  setBirthday(formatLocalDate(date))
                  setBirthdayPickerOpen(false)
                }}
              />
              {errors.birthday ? (
                <Text style={[styles.error, { color: colors.error }]}>
                  {t('graph.awaken_birthday_required', '请选择生日')}
                </Text>
              ) : null}

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('graph.awaken_gender_label', '性别')}
              </Text>
              <Select
                variant="settings"
                options={USER_GENDER_OPTIONS.map((g) => ({
                  value: g,
                  label: genderLabel(g)
                }))}
                value={gender || undefined}
                onValueChange={(value) => setGender(value as UserGender)}
                placeholder={t('graph.awaken_gender_placeholder', '选择性别')}
                triggerStyle={[
                  fieldChrome,
                  {
                    borderColor: errors.gender ? colors.error : colors.borderControl
                  }
                ]}
                chevron="▼"
                chevronStyle={styles.fieldChevron}
              />
              {gender === 'other' ? (
                <View
                  style={[
                    fieldChrome,
                    {
                      borderColor: colors.borderControl,
                      backgroundColor: colors.bgSurface
                    }
                  ]}
                >
                  <Input
                    bare
                    value={customGender}
                    onChangeText={setCustomGender}
                    editable={!busy}
                    placeholder={t('graph.awaken_gender_custom_placeholder', '输入自定义性别')}
                    style={styles.nicknameInput}
                  />
                </View>
              ) : null}
              {errors.gender ? (
                <Text style={[styles.error, { color: colors.error }]}>
                  {t('graph.awaken_gender_required', '请选择性别')}
                </Text>
              ) : null}

              <View
                style={[styles.actions, { gap: tokens.spacing.sm, marginTop: tokens.spacing.md }]}
              >
                <Button
                  variant="outlined"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => setStep('welcome')}
                >
                  {t('graph.awaken_back', '返回')}
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  isDisabled={busy}
                  onPress={() => void handleSubmit()}
                >
                  {t('graph.awaken_submit', '开始使用')}
                </Button>
              </View>
            </>
          )}
        </FadeSlideIn>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.lg,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: 88,
    gap: sharedTokens.spacing.smPlus
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: mobileTypography.title.fontWeight,
    lineHeight: 24,
    marginBottom: sharedTokens.spacing.xsPlus
  },
  body: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight,
    lineHeight: 22,
    marginBottom: sharedTokens.spacing.md
  },
  label: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: mobileTypography.primary.fontWeight,
    marginTop: sharedTokens.spacing.sm
  },
  fieldControl: {
    minHeight: 40,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: 0,
    fontSize: mobileTypography.body.fontSize
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fieldText: {
    flex: 1,
    fontSize: mobileTypography.body.fontSize
  },
  fieldChevron: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '400'
  },
  nicknameInput: {
    fontSize: mobileTypography.body.fontSize,
    minHeight: 40,
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  error: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: mobileTypography.caption.fontWeight
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
})
