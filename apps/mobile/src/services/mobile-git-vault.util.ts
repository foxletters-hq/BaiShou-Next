import { i18n } from '@baishou/shared'

export function mobileGitPlatformLimitMessage(): string {
  return i18n.t(
    'version_control.mobile_cli_unavailable',
    '当前移动端没有可用的 Git 命令行，无法完成提交或远程同步。配置与初始化可以保存，完整推送请在桌面端继续。'
  )
}

export const MOBILE_GIT_PLATFORM_LIMIT = mobileGitPlatformLimitMessage()

export function isMobileGitHttpRemote(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function mobileGitUnsupportedAction(): never {
  throw new Error(mobileGitPlatformLimitMessage())
}
