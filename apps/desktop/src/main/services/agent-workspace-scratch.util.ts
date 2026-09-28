import * as path from 'path'

/** 旧版默认工作区目录名（识别用，便于迁移） */
// eslint-disable-next-line i18n-chinese/no-hardcoded-chinese -- legacy folder identity
export const LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES = ['纯白信纸'] as const

/**
 * 稿纸展示名（产品固定中文目录名，与 i18n 文案一致）。
 * 目录名本身不可随语言切换，故保留字面量。
 */
// eslint-disable-next-line i18n-chinese/no-hardcoded-chinese -- stable product folder name
export const SCRATCH_WORKSPACE_DISPLAY_NAME = '稿纸'

/**
 * 解析应用安装目录根路径。
 * 打包后取可执行文件所在目录；开发态取 appPath（通常为应用源码/构建根）。
 */
export function resolveAppInstallRoot(params: {
  isPackaged: boolean
  exePath: string
  appPath: string
}): string {
  if (params.isPackaged) {
    const exe = params.exePath.trim()
    return exe ? path.dirname(exe) : params.appPath
  }
  return params.appPath
}

/**
 * 解析「稿纸」目录路径。
 * 优先用户文档目录；文档目录不可用时回退 userDataRoot/稿纸。
 */
export function resolveScratchWorkspaceFolderRoot(params: {
  documentsRoot: string | null | undefined
  userDataRoot: string
}): string {
  const base =
    typeof params.documentsRoot === 'string' && params.documentsRoot.trim()
      ? params.documentsRoot.trim()
      : params.userDataRoot
  return path.join(base, SCRATCH_WORKSPACE_DISPLAY_NAME)
}

/** 旧版曾把稿纸放在安装目录或 userData，迁移时按这个名单查找。 */
export function listLegacyScratchFolderCandidates(params: {
  installRoot: string | null | undefined
  userDataRoot: string
}): string[] {
  const names = [SCRATCH_WORKSPACE_DISPLAY_NAME, ...LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES]
  const bases: string[] = []
  if (typeof params.installRoot === 'string' && params.installRoot.trim()) {
    bases.push(params.installRoot.trim())
  }
  if (params.userDataRoot.trim()) bases.push(params.userDataRoot.trim())
  return bases.flatMap((base) => names.map((name) => path.join(base, name)))
}

export function isScratchWorkspaceEntry(entry: {
  kind?: string | null
  displayName?: string | null
}): boolean {
  if (entry.kind === 'scratch') return true
  const name = entry.displayName?.trim()
  if (!name) return false
  if (name === SCRATCH_WORKSPACE_DISPLAY_NAME) return true
  return (LEGACY_SCRATCH_WORKSPACE_DISPLAY_NAMES as readonly string[]).includes(name)
}
