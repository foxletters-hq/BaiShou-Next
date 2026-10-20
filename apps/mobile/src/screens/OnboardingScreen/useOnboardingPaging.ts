import { useCallback, type MutableRefObject, type RefObject } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'
import type { TFunction } from 'i18next'
import { NUM_ONBOARDING_PAGES, ONBOARDING_PAGE } from './onboarding-theme'
import { SCREEN_WIDTH } from './OnboardingScreen.styles'

type OnboardingPagingOptions = {
  currentPage: number
  setCurrentPage: (page: number) => void
  languageConfirmed: boolean
  isPreview: boolean
  nickname: string
  storageReadyToAdvance: boolean
  scrollViewRef: RefObject<ScrollView | null>
  programmaticTargetRef: MutableRefObject<number | null>
  setNicknameError: (missing: boolean) => void
  toast: { showWarning: (message: string) => void }
  t: TFunction
  normalizeNickname: (value: string) => string | null
}

/** 引导页的横向分页、手势滚动拦截与返回上一页 */
export function useOnboardingPaging({
  currentPage,
  setCurrentPage,
  languageConfirmed,
  isPreview,
  nickname,
  storageReadyToAdvance,
  scrollViewRef,
  programmaticTargetRef,
  setNicknameError,
  toast,
  t,
  normalizeNickname
}: OnboardingPagingOptions) {
  const goToPage = useCallback(
    (page: number, options?: { animated?: boolean }) => {
      const target = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))
      programmaticTargetRef.current = target
      scrollViewRef.current?.scrollTo({
        x: target * SCREEN_WIDTH,
        animated: options?.animated ?? true
      })
    },
    [programmaticTargetRef, scrollViewRef]
  )

  const handlePrevious = useCallback(() => {
    if (currentPage > 0) {
      goToPage(currentPage - 1)
    }
  }, [currentPage, goToPage])

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    const clampedPage = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))

    const pendingTarget = programmaticTargetRef.current
    if (pendingTarget !== null) {
      if (clampedPage !== pendingTarget) {
        return
      }
      programmaticTargetRef.current = null
    }

    if (clampedPage > ONBOARDING_PAGE.LANGUAGE && !languageConfirmed && !isPreview) {
      programmaticTargetRef.current = ONBOARDING_PAGE.LANGUAGE
      setCurrentPage(ONBOARDING_PAGE.LANGUAGE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.LANGUAGE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('onboarding.language_required'))
      return
    }

    if (clampedPage > ONBOARDING_PAGE.PROFILE && !normalizeNickname(nickname)) {
      setNicknameError(true)
      programmaticTargetRef.current = ONBOARDING_PAGE.PROFILE
      setCurrentPage(ONBOARDING_PAGE.PROFILE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.PROFILE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
      return
    }

    if (clampedPage > ONBOARDING_PAGE.STORAGE && !storageReadyToAdvance) {
      programmaticTargetRef.current = ONBOARDING_PAGE.STORAGE
      setCurrentPage(ONBOARDING_PAGE.STORAGE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.STORAGE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('storage.all_files_access_settings_hint'))
      return
    }

    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage)
    }
  }

  return { goToPage, handlePrevious, handleScroll }
}
