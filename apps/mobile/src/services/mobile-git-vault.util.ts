export const MOBILE_GIT_PLATFORM_LIMIT =
  '当前移动端没有可用的 Git 命令行，无法完成提交或远程同步。配置与初始化可以保存，完整推送请在桌面端继续。'

export function isMobileGitHttpRemote(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function mobileGitUnsupportedAction(): never {
  throw new Error(MOBILE_GIT_PLATFORM_LIMIT)
}
