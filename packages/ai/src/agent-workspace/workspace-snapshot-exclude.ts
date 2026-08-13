/** 单个未跟踪文件进入快照的体积上限，超过则不纳入回滚范围 */
export const DEFAULT_MAX_UNTRACKED_FILE_BYTES = 2 * 1024 * 1024

/**
 * 写入影子仓库 `info/exclude` 的默认排除规则。
 *
 * 只排除「重新生成即可」或「本就不该进版本」的东西：用户工作区里的 `.gitignore`
 * 会被 `--exclude-standard` 一并尊重，所以这里保持克制，避免把用户真想回滚的
 * 目录挡在快照外面。
 */
export const DEFAULT_SNAPSHOT_EXCLUDE_RULES: readonly string[] = [
  '.git/',
  'node_modules/',
  '__pycache__/',
  '.venv/',
  // Office 在编辑时生成的锁文件，随开随关，纳入快照只会制造噪音
  '~$*',
  '.~lock.*',
  '*.tmp',
  '*.temp',
  '*.swp',
  '.DS_Store',
  'Thumbs.db'
]

export function buildSnapshotExcludeFile(rules: readonly string[] = DEFAULT_SNAPSHOT_EXCLUDE_RULES): string {
  return `${['# 由工作台快照自动生成，请勿手工编辑', ...rules].join('\n')}\n`
}

export interface SnapshotSizeFilterInput {
  paths: readonly string[]
  maxBytes: number
  /** 返回 null 表示路径已不存在（例如本轮被删除），删除同样需要进入快照 */
  fileSize: (relativePath: string) => Promise<number | null>
}

export interface SnapshotSizeFilterResult {
  allowed: string[]
  oversized: string[]
}

/**
 * 按体积筛掉过大的未跟踪文件。
 * 读不到大小的路径一律放行：宁可收进快照，也不要因为一次 stat 失败就让它无法回滚。
 */
export async function filterOversizedPaths(
  input: SnapshotSizeFilterInput
): Promise<SnapshotSizeFilterResult> {
  const allowed: string[] = []
  const oversized: string[] = []

  for (const relativePath of input.paths) {
    const size = await input.fileSize(relativePath)
    if (size != null && size > input.maxBytes) {
      oversized.push(relativePath)
      continue
    }
    allowed.push(relativePath)
  }

  return { allowed, oversized }
}

/**
 * 把路径切成多批，规避 Windows 命令行长度上限。
 * 走 stdin 的命令不需要它，但 ls-tree 这类只能用命令行 pathspec 的命令需要。
 */
export function chunkPathspecs(
  paths: readonly string[],
  options: { maxCount?: number; maxChars?: number } = {}
): string[][] {
  const maxCount = options.maxCount ?? 200
  const maxChars = options.maxChars ?? 24_000
  const chunks: string[][] = []
  let current: string[] = []
  let currentChars = 0

  for (const path of paths) {
    const cost = path.length + 1
    if (current.length > 0 && (current.length >= maxCount || currentChars + cost > maxChars)) {
      chunks.push(current)
      current = []
      currentChars = 0
    }
    current.push(path)
    currentChars += cost
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

/** git 的 -z 输出以 NUL 分隔且结尾可能带一个空段 */
export function splitNulSeparated(output: string): string[] {
  return output.split('\0').filter((entry) => entry.length > 0)
}

export function joinNulSeparated(paths: readonly string[]): string {
  return paths.length === 0 ? '' : `${paths.join('\0')}\0`
}
