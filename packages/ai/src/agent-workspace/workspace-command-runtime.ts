export const WORKSPACE_COMMAND_RUNTIME_FAMILIES = [
  'win_console',
  'win_powershell',
  'win_pwsh',
  'unix_shell'
] as const
export type WorkspaceCommandRuntimeFamily = (typeof WORKSPACE_COMMAND_RUNTIME_FAMILIES)[number]

/** 交互式终端专用、不适合当工作台命令运行环境的二进制。 */
const SKIPPED_RUNTIME_BINARIES = new Set(['fish', 'nu'])

export interface WorkspaceCommandRuntime {
  executable: string
  binary: string
  family: WorkspaceCommandRuntimeFamily
  label: string
}

export interface DetectWorkspaceCommandRuntimeInput {
  platform?: string
  env?: Record<string, string | undefined>
  /** 仅测试注入；产品路径一律本机探测，不提供设置项 */
  override?: string | null
  locate?: (name: string) => string | undefined
  exists?: (file: string) => boolean
}

function envOf(input?: DetectWorkspaceCommandRuntimeInput): Record<string, string | undefined> {
  return input?.env ?? {}
}

function platformOf(input?: DetectWorkspaceCommandRuntimeInput): string {
  return input?.platform ?? 'linux'
}

export function runtimeBinaryName(file: string, platform: string): string {
  const normalized = platform === 'win32' ? file.replace(/\//g, '\\') : file
  const base = normalized.split(platform === 'win32' ? '\\' : '/').pop() ?? normalized
  return base.replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
}

export function runtimeFamilyOf(binary: string): WorkspaceCommandRuntimeFamily {
  if (binary === 'cmd') return 'win_console'
  if (binary === 'powershell') return 'win_powershell'
  if (binary === 'pwsh') return 'win_pwsh'
  return 'unix_shell'
}

export function runtimeLabelOf(binary: string): string {
  if (binary === 'pwsh') return 'PowerShell Core'
  if (binary === 'powershell') return 'Windows PowerShell'
  if (binary === 'cmd') return 'Windows console'
  return `Unix shell (${binary})`
}

export function isSkippedRuntimeBinary(binary: string): boolean {
  return SKIPPED_RUNTIME_BINARIES.has(binary)
}

function toRuntime(executable: string, platform: string): WorkspaceCommandRuntime {
  const binary = runtimeBinaryName(executable, platform)
  return {
    executable,
    binary,
    family: runtimeFamilyOf(binary),
    label: runtimeLabelOf(binary)
  }
}

function firstUsable(
  candidates: Array<string | undefined>,
  exists: (file: string) => boolean
): string | undefined {
  for (const candidate of candidates) {
    if (!candidate) continue
    if (candidate === 'cmd.exe' || exists(candidate)) return candidate
  }
  return undefined
}

function resolveGitUnixLayer(
  locate: (name: string) => string | undefined,
  exists: (file: string) => boolean,
  platform: string
): string | undefined {
  if (platform !== 'win32') return undefined
  const git = locate('git')
  if (!git) return undefined
  const parts = git.replace(/\//g, '\\').split('\\').filter(Boolean)
  parts.pop()
  parts.pop()
  const bash = `${parts.join('\\')}\\bin\\bash.exe`
  return exists(bash) ? bash : undefined
}

function resolveNamed(
  raw: string,
  input: DetectWorkspaceCommandRuntimeInput,
  locate: (name: string) => string | undefined,
  exists: (file: string) => boolean
): string | undefined {
  const platform = platformOf(input)
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const binary = runtimeBinaryName(trimmed, platform)
  if (isSkippedRuntimeBinary(binary)) return undefined
  if (platform === 'win32' && binary === 'bash') {
    return resolveGitUnixLayer(locate, exists, platform) ?? locate(trimmed) ?? locate('bash')
  }
  if (exists(trimmed)) return trimmed
  return locate(binary) ?? locate(trimmed)
}

function detectWindows(
  input: DetectWorkspaceCommandRuntimeInput,
  locate: (name: string) => string | undefined,
  exists: (file: string) => boolean
): string {
  const env = envOf(input)
  return (
    firstUsable(
      [
        locate('pwsh'),
        locate('powershell'),
        resolveGitUnixLayer(locate, exists, 'win32'),
        env.ComSpec || env.COMSPEC
      ],
      exists
    ) || 'cmd.exe'
  )
}

function detectUnix(
  input: DetectWorkspaceCommandRuntimeInput,
  locate: (name: string) => string | undefined,
  exists: (file: string) => boolean
): string {
  const platform = platformOf(input)
  if (platform === 'darwin' && exists('/bin/zsh')) return '/bin/zsh'
  return locate('bash') || (exists('/bin/bash') ? '/bin/bash' : '/bin/sh')
}

/**
 * 探测本机工作台命令运行环境。模型只写这个环境里的命令，不要再包一层启动器。
 * Windows 顺序：PowerShell Core → Windows PowerShell → Git 的 Unix 层 → 控制台。
 */
export function detectWorkspaceCommandRuntime(
  input: DetectWorkspaceCommandRuntimeInput = {}
): WorkspaceCommandRuntime {
  const platform = platformOf(input)
  const env = envOf(input)
  const exists = input.exists ?? (() => false)
  const locate = input.locate ?? (() => undefined)

  const override = resolveNamed(input.override ?? '', input, locate, exists)
  if (override) return toRuntime(override, platform)

  const fromEnv = resolveNamed(env.SHELL ?? '', input, locate, exists)
  if (fromEnv) return toRuntime(fromEnv, platform)

  const detected = platform === 'win32' ? detectWindows(input, locate, exists) : detectUnix(input, locate, exists)
  return toRuntime(detected, platform)
}

export function buildWorkspaceRunToolDescription(
  runtime: WorkspaceCommandRuntime,
  platform: string
): string {
  const chain =
    runtime.family === 'win_powershell'
      ? 'This environment does not accept && between commands. Write `first; if ($?) { second }` when the second step depends on the first.'
      : 'When a later step depends on an earlier one, join them with && in the same workspace_run call.'
  return [
    `workspace_run starts ${runtime.label} on ${platform} for you.`,
    'Pass only the inner command, such as mkdir folder or git status. Do not prefix cmd /c, powershell -Command, or bash -c.',
    chain,
    'Change directories with the workdir argument, not inside the command text.',
    'The process uses the app host privileges and is only available in workspace sessions.'
  ].join(' ')
}

export function planWorkspaceCommandSpawn(
  runtime: WorkspaceCommandRuntime,
  command: string
): {
  file: string
  args: string[]
  attachRuntimeAsShell: boolean
} {
  if (runtime.family === 'win_powershell' || runtime.family === 'win_pwsh') {
    return {
      file: runtime.executable,
      args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      attachRuntimeAsShell: false
    }
  }
  return { file: command, args: [], attachRuntimeAsShell: true }
}

export function isWindowsPowerShellFamily(family: WorkspaceCommandRuntimeFamily): boolean {
  return family === 'win_powershell' || family === 'win_pwsh'
}
