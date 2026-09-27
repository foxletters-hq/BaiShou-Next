import { dirname, join } from 'node:path'

export interface WindowsToastShortcutOptions {
  target: string
  cwd: string
  args: string
  appUserModelId: string
  description: string
  icon?: string
  iconIndex: number
}

/** Windows Toast 需要「开始菜单快捷方式的 AUMID」与进程 AUMID 一致 */
export function resolveWindowsToastShortcutPath(appData: string, appName: string): string {
  return join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${appName}.lnk`)
}

export function buildWindowsToastShortcutOptions(input: {
  execPath: string
  packaged: boolean
  argv: string[]
  appUserModelId: string
  iconPath?: string
  description: string
}): WindowsToastShortcutOptions {
  const quotedArgs = input.argv
    .slice(1)
    .filter((arg) => arg.length > 0)
    .map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))
    .join(' ')
  return {
    target: input.execPath,
    cwd: dirname(input.execPath),
    args: input.packaged ? '' : quotedArgs,
    appUserModelId: input.appUserModelId,
    description: input.description,
    ...(input.iconPath ? { icon: input.iconPath } : {}),
    iconIndex: 0
  }
}
