import { Vibration } from 'react-native'
import * as Haptics from 'expo-haptics'

/** 拖动激活时的轻触。expo 调用失败时改用系统短震动。 */
export function nativeLightHaptic(): void {
  try {
    void Promise.resolve(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)).catch(() => {
      Vibration.vibrate(10)
    })
  } catch {
    Vibration.vibrate(10)
  }
}
