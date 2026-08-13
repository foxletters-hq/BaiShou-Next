import React, { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  isDefaultGraphSelfName,
  USER_GENDER_OPTIONS,
  validateGraphAwakenForm,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import { GraphAwakenBirthdayField } from './GraphAwakenBirthdayField'
import styles from './GraphAwakenWelcome.module.css'

export type GraphAwakenSubmitPayload = {
  nickname: string
  birthday: string
  gender: UserGender
}

type Step = 'welcome' | 'profile'

export interface GraphAwakenWelcomeProps {
  initialProfile?: Pick<UserProfile, 'nickname' | 'birthday' | 'gender'> | null
  busy?: boolean
  onSubmit: (payload: GraphAwakenSubmitPayload) => void | Promise<void>
}

const stepMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }
}

export const GraphAwakenWelcome: React.FC<GraphAwakenWelcomeProps> = ({
  initialProfile,
  busy = false,
  onSubmit
}) => {
  const { t } = useTranslation()
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
    <div className={styles.root} role="dialog" aria-modal="true">
      <div className={styles.atmosphere} aria-hidden />
      <div className={styles.panel}>
        <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            <motion.div key="welcome" className={styles.step} {...stepMotion}>
              <h1 className={styles.title}>
                {t('graph.awaken_welcome_title', '唤醒你的关系图谱')}
              </h1>
              <p className={styles.body}>
                {t(
                  'graph.awaken_welcome_body',
                  '从日记里整理出人与人的联结。先告诉我们「我」是谁，伙伴才能准确认出你。'
                )}
              </p>
              <button
                type="button"
                className={styles.cta}
                disabled={busy}
                onClick={() => setStep('profile')}
              >
                {t('graph.awaken_welcome_cta', '唤醒关系图谱')}
              </button>
            </motion.div>
          ) : (
            <motion.div key="profile" className={styles.step} {...stepMotion}>
              <h1 className={styles.title}>{t('graph.awaken_form_title', '关于你')}</h1>
              <p className={styles.body}>
                {t(
                  'graph.awaken_form_body',
                  '这些信息会写入你的身份资料，并用于图谱抽取时识别日记中的「我」。'
                )}
              </p>

              <label className={styles.field}>
                <span>{t('graph.awaken_nickname_label', '昵称')}</span>
                <input
                  className={styles.input}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('graph.awaken_nickname_placeholder', '怎么称呼你？')}
                  autoFocus
                  disabled={busy}
                />
                {errors.nickname ? (
                  <span className={styles.error}>
                    {t('graph.awaken_nickname_required', '请填写昵称')}
                  </span>
                ) : null}
              </label>

              <div className={styles.field}>
                <span>{t('graph.awaken_birthday_label', '生日')}</span>
                <GraphAwakenBirthdayField
                  value={birthday}
                  onChange={setBirthday}
                  disabled={busy}
                  hasError={!!errors.birthday}
                />
                {errors.birthday ? (
                  <span className={styles.error}>
                    {t('graph.awaken_birthday_required', '请选择生日')}
                  </span>
                ) : null}
              </div>

              <div className={styles.field}>
                <span>{t('graph.awaken_gender_label', '性别')}</span>
                <div className={styles.genderRow} role="radiogroup">
                  {USER_GENDER_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={gender === g}
                      className={gender === g ? styles.genderChipActive : styles.genderChip}
                      disabled={busy}
                      onClick={() => setGender(g)}
                    >
                      {genderLabel(g)}
                    </button>
                  ))}
                </div>
                {errors.gender ? (
                  <span className={styles.error}>
                    {t('graph.awaken_gender_required', '请选择性别')}
                  </span>
                ) : null}
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => setStep('welcome')}
                >
                  {t('graph.awaken_back', '返回')}
                </button>
                <button
                  type="button"
                  className={styles.cta}
                  disabled={busy}
                  onClick={() => void handleSubmit()}
                >
                  {t('graph.awaken_submit', '开始使用')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
