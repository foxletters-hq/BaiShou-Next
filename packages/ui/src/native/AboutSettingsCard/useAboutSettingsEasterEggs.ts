import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '../Toast'

export interface AboutSettingsEasterEggOptions {
  onDevModeUnlock?: () => void
}

export function useAboutSettingsEasterEggs(options: AboutSettingsEasterEggOptions = {}) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const logoTapCount = useRef(0)
  const logoTapLast = useRef(0)
  const devTapCount = useRef(0)
  const devTapLast = useRef(0)

  const handleLogoTap = () => {
    const now = Date.now()
    if (now - logoTapLast.current < 1000) {
      logoTapCount.current++
    } else {
      logoTapCount.current = 1
    }
    logoTapLast.current = now

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0
      toast.showSuccess(t('about.love_message', '🌸樱&晓 永远爱着Anson❤️'))
    }
  }

  const handleDevTap = () => {
    const now = Date.now()
    if (now - devTapLast.current < 2000) {
      devTapCount.current++
    } else {
      devTapCount.current = 1
    }
    devTapLast.current = now

    const count = devTapCount.current
    if (count >= 7 && count < 10) {
      const remaining = 10 - count
      const msg = t('about.dev_mode_hint', '再点 $count 次进入开发者模式').replace(
        '$count',
        remaining.toString()
      )
      toast.showInfo(msg)
    } else if (count >= 10) {
      devTapCount.current = 0
      options.onDevModeUnlock?.()
    }
  }

  return { handleLogoTap, handleDevTap }
}
