// @ts-ignore - Node built-in, available at runtime
import { existsSync } from 'node:fs'
// @ts-ignore - Node built-in, available at runtime
import { delimiter, join } from 'node:path'

export function existsOnCommandPath(file: string): boolean {
  try {
    return existsSync(file)
  } catch {
    return false
  }
}

/** 在 PATH 与 Windows 常见安装位置查找命令运行环境的可执行文件。 */
export function locateCommandRuntimeExecutable(
  name: string,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const platform = process.platform
  const pathValue = platform === 'win32' ? (env.Path ?? env.PATH ?? '') : (env.PATH ?? '')
  const names =
    platform === 'win32' && !/\.[a-z0-9]+$/i.test(name)
      ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`]
      : [name]

  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    for (const candidateName of names) {
      const candidate = join(dir, candidateName)
      if (existsOnCommandPath(candidate)) return candidate
    }
  }

  if (platform === 'win32' && /^powershell$/i.test(name.replace(/\.exe$/i, ''))) {
    const root = env.SystemRoot || env.windir || 'C:\\Windows'
    const wellKnown = join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsOnCommandPath(wellKnown)) return wellKnown
  }

  return undefined
}
