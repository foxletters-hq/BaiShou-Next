import type { StackScreenHeaderProps } from './StackScreenHeader'
import type { useNativeTheme } from '@baishou/ui/native'

type ThemeColors = ReturnType<typeof useNativeTheme>['colors']

/** 栈内页：灰底内容区 + 白色顶栏条（与 StackScreenHeader 默认样式配套） */
export function getStackScreenChrome(colors: ThemeColors): Pick<
  StackScreenHeaderProps,
  'transparent'
> & { backgroundColor: string } {
  return {
    backgroundColor: colors.bgApp,
    transparent: false
  }
}
