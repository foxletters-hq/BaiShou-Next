import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated
} from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatLocalDate,
  isDefaultGraphSelfName,
  USER_GENDER_OPTIONS,
  validateGraphAwakenForm,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import { useNativeTheme, DatePickerFloatingModal } from '@baishou/ui/native'

export type GraphAwakenSubmitPayload = {
  nickname: string
  birthday: string
  gender: UserGender
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
        duration: 280,
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true
      })
    ]).start()
  }, [animKey, opacity, translateY])

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>
  )
}

export function GraphAwakenWelcome(props: {
  initialProfile?: Pick<UserProfile, 'nickname' | 'birthday' | 'gender'> | null
  busy?: boolean
  onSubmit: (payload: GraphAwakenSubmitPayload) => void | Promise<void>
}) {
  const { initialProfile, busy = false, onSubmit } = props
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
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
  const [errors, setErrors] = useState<{ nickname?: boolean; birthday?: boolean; gender?: boolean }>(
    {}
  )
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

  const maxBirthday = useMemo(() => new Date(), [])
  const minBirthday = useMemo(() => new Date(1900, 0, 1), [])

  const genderLabel = (g: UserGender) => {
    switch (g) {
      case 'male':
        return t('graph.awaken_gender_male', '男')
      case 'female':
        return t('graph.awaken_gender_female', '女')
      case 'other':
        return t('graph.awaken_gender_other', '其他')
      default:
        return t('graph.awaken_gender_unspecified', '不愿透露')
    }
  }

  const handleSubmit = async () => {
    const nextErrors = validateGraphAwakenForm({ nickname, birthday, gender })
    setErrors({
      nickname: !!nextErrors.nickname,
      birthday: !!nextErrors.birthday,
      gender: !!nextErrors.gender
    })
    if (Object.keys(nextErrors).length > 0) return
    await onSubmit({
      nickname: nickname.trim(),
      birthday: birthday.trim(),
      gender: gender as UserGender
    })
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bgApp }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FadeSlideIn animKey={step}>
          {step === 'welcome' ? (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('graph.awaken_welcome_title', '唤醒你的关系图谱')}
              </Text>
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                {t(
                  'graph.awaken_welcome_body',
                  '从日记里整理出人与人的联结。先告诉我们「我」是谁，伙伴才能准确认出你。'
                )}
              </Text>
              <Pressable
                disabled={busy}
                onPress={() => setStep('profile')}
                style={[
                  styles.cta,
                  {
                    borderColor: colors.borderSubtle,
                    opacity: busy ? 0.55 : 1
                  }
                ]}
              >
                <Text style={[styles.ctaText, { color: colors.textPrimary }]}>
                  {t('graph.awaken_welcome_cta', '唤醒关系图谱')}
                </Text>
              </Pressable>
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
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                editable={!busy}
                placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              />
              {errors.nickname ? (
                <Text style={styles.error}>{t('graph.awaken_nickname_required', '请填写昵称')}</Text>
              ) : null}

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('graph.awaken_birthday_label', '生日')}
              </Text>
              <Pressable
                disabled={busy}
                onPress={() => setBirthdayPickerOpen(true)}
                style={[
                  styles.input,
                  styles.birthdayTrigger,
                  {
                    borderColor: errors.birthday ? '#c2410c' : colors.borderSubtle,
                    backgroundColor: colors.bgSurface,
                    opacity: busy ? 0.55 : 1
                  }
                ]}
              >
                <Text
                  style={{
                    color: /^\d{4}-\d{2}-\d{2}$/.test(birthday.trim())
                      ? colors.textPrimary
                      : colors.textSecondary,
                    fontSize: 15
                  }}
                >
                  {birthdayLabel}
                </Text>
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
                <Text style={styles.error}>{t('graph.awaken_birthday_required', '请选择生日')}</Text>
              ) : null}

              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {t('graph.awaken_gender_label', '性别')}
              </Text>
              <View style={styles.genderRow}>
                {USER_GENDER_OPTIONS.map((g) => {
                  const active = gender === g
                  return (
                    <Pressable
                      key={g}
                      disabled={busy}
                      onPress={() => setGender(g)}
                      style={[
                        styles.chip,
                        {
                          borderColor: active ? colors.primary : colors.borderSubtle,
                          backgroundColor: active ? colors.bgSurfaceNormal : colors.bgSurface
                        }
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? colors.primary : colors.textPrimary,
                          fontWeight: active ? '700' : '500',
                          fontSize: 13
                        }}
                      >
                        {genderLabel(g)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              {errors.gender ? (
                <Text style={styles.error}>{t('graph.awaken_gender_required', '请选择性别')}</Text>
              ) : null}

              <View style={styles.actions}>
                <Pressable disabled={busy} onPress={() => setStep('welcome')} style={styles.backBtn}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                    {t('graph.awaken_back', '返回')}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => void handleSubmit()}
                  style={[
                    styles.cta,
                    {
                      borderColor: colors.borderSubtle,
                      flex: 1,
                      opacity: busy ? 0.55 : 1
                    }
                  ]}
                >
                  <Text style={[styles.ctaText, { color: colors.textPrimary }]}>
                    {t('graph.awaken_submit', '开始使用')}
                  </Text>
                </Pressable>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 10
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 6
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15
  },
  birthdayTrigger: {
    justifyContent: 'center'
  },
  genderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  chip: {
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  error: {
    color: '#c2410c',
    fontSize: 12
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 8
  },
  cta: {
    height: undefined,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 8,
    backgroundColor: 'transparent'
  },
  ctaText: {
    fontWeight: '600',
    fontSize: 14
  }
})
