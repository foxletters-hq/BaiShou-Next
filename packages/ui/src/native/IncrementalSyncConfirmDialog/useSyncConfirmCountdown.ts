import { useEffect, useState } from 'react'
import { computeSyncConfirmSecondsLeftUntil, isSyncConfirmEligible } from '@baishou/shared'

/** 仅在秒数变化或倒计时结束时更新，避免高频 setState 打断 ScrollView 手势 */
export function useSyncConfirmCountdown(
  needsSyncConfirm: boolean,
  confirmEligibleAtMs: number | null
): { confirmReady: boolean; secondsLeft: number } {
  const [state, setState] = useState(() => ({
    confirmReady: !needsSyncConfirm || confirmEligibleAtMs == null,
    secondsLeft:
      needsSyncConfirm && confirmEligibleAtMs != null
        ? computeSyncConfirmSecondsLeftUntil(confirmEligibleAtMs)
        : 0
  }))

  useEffect(() => {
    if (!needsSyncConfirm || confirmEligibleAtMs == null) {
      setState({ confirmReady: true, secondsLeft: 0 })
      return undefined
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const sync = () => {
      const now = Date.now()
      const confirmReady = isSyncConfirmEligible(confirmEligibleAtMs, now)
      const secondsLeft = computeSyncConfirmSecondsLeftUntil(confirmEligibleAtMs, now)
      setState((prev) =>
        prev.confirmReady === confirmReady && prev.secondsLeft === secondsLeft
          ? prev
          : { confirmReady, secondsLeft }
      )
      return confirmReady
    }

    if (sync()) {
      return undefined
    }

    const schedule = () => {
      if (cancelled) return
      if (sync()) return

      const now = Date.now()
      const msUntilEligible = Math.max(0, confirmEligibleAtMs - now)
      const msUntilNextSecond = 1000 - (now % 1000)
      const delay =
        msUntilEligible > 0 ? Math.min(msUntilNextSecond, msUntilEligible) : msUntilNextSecond
      timer = setTimeout(schedule, Math.max(delay, 50))
    }

    schedule()

    return () => {
      cancelled = true
      if (timer != null) clearTimeout(timer)
    }
  }, [needsSyncConfirm, confirmEligibleAtMs])

  return state
}
