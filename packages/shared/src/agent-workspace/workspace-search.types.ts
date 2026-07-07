export interface WorkspaceSearchOptions {
  pattern: string
  matchCase?: boolean
  matchWholeWord?: boolean
  useRegex?: boolean
  /** 逗号分隔 glob，例如 ts 与 md 文件的通配模式 */
  includePattern?: string
  /** 逗号分隔 glob，默认排除 node_modules、.git 等 */
  excludePattern?: string
  maxMatches?: number
  maxFiles?: number
}

export interface WorkspaceSearchMatch {
  line: number
  lineText: string
  matchStart: number
  matchEnd: number
}

export interface WorkspaceSearchFileResult {
  relativePath: string
  matches: WorkspaceSearchMatch[]
}

export interface WorkspaceSearchResult {
  files: WorkspaceSearchFileResult[]
  totalMatches: number
  totalFiles: number
  truncated: boolean
  invalidPattern?: boolean
}

export interface WorkspaceReplaceOptions extends WorkspaceSearchOptions {
  replacement: string
}

export interface WorkspaceReplaceResult {
  filesChanged: number
  replacements: number
  errors: string[]
}
