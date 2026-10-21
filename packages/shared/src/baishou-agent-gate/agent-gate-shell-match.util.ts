/**
 * Structured shell-command matching for Agent Gate (G3).
 * Prefer argv prefix + arity over substring globs so `rm` never matches `harmless`.
 */

/** Binaries that must never receive a reusable Always prefix (exact Once only). */
const ALWAYS_FORBIDDEN_BINARIES = new Set([
  'python',
  'python3',
  'node',
  'deno',
  'ruby',
  'perl',
  'php',
  'lua',
  'bash',
  'sh',
  'zsh',
  'fish',
  'cmd',
  'powershell',
  'pwsh',
  'rm',
  'rmdir',
  'del',
  'erase',
  'rd',
  'curl',
  'wget',
  'ssh',
  'scp',
  'dd',
  'mkfs',
  'format',
  'diskpart',
  'reg',
  'shutdown'
])

/** How many leading argv tokens form a reusable Always prefix for a given binary. */
const COMMAND_PREFIX_ARITY: Record<string, number> = {
  git: 2,
  npm: 2,
  pnpm: 2,
  yarn: 2,
  bun: 2,
  cargo: 2,
  go: 2,
  docker: 2,
  kubectl: 2,
  pip: 2,
  pip3: 2,
  poetry: 2,
  cp: 1,
  copy: 1,
  mv: 1,
  move: 1,
  cat: 1,
  type: 1,
  mkdir: 1,
  md: 1,
  touch: 1,
  chmod: 1,
  chown: 1,
  tar: 1,
  zip: 1,
  unzip: 1
}

/**
 * Patterns for catastrophic destructive commands (recursive wipe / disk format / shutdown).
 * Inline interpreter flags (`python -c`, `node -e`, `bash -c`, `powershell -Command`) are NOT treated
 * as dangerous red-line commands here; their permanent allowlist eligibility is governed separately
 * by `ALWAYS_FORBIDDEN_BINARIES`.
 */
const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr|--recursive)\b/i,
  /\bdel\s+\/s\b/i,
  /\brd\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs(\.|$|\s)/i,
  /\bdd\s+.*\bif=/i,
  /\b(Remove-Item|ri)\b.*-Recurse\b/i,
  /\bcipher\s+\/w\b/i,
  /\bdiskpart\b/i,
  /\breg\s+delete\b/i,
  /\bshutdown\b/i
]

/**
 * 工作台默认命令黑名单（展示 + 子串匹配；与 DANGEROUS_SHELL_PATTERNS 叠加）。
 * 含 rm -rf / 递归删除 / 格式化等。
 */
export const DEFAULT_WORKSPACE_COMMAND_BLACKLIST = [
  'rm -rf',
  'rm -fr',
  'rm --recursive',
  'del /s',
  'rd /s',
  'rmdir /s',
  'Remove-Item -Recurse',
  'format ',
  'mkfs',
  'diskpart',
  'shutdown',
  'reg delete',
  'dd if=',
  'git reset --hard',
  'git clean -fd',
  'git push --force',
  'git push -f'
] as const

const SHELL_OPERATOR_RE = /(?:&&|\|\||[|;`]|\$\()/

const DIRECTORY_CHANGE_BINARIES = new Set([
  'cd',
  'chdir',
  'pushd',
  'popd',
  'set-location',
  'push-location',
  'pop-location',
  'sl'
])

function hasCommandSubstitution(command: string): boolean {
  const stripped = command.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, ' ')
  return /(?:`|\$\()/.test(stripped)
}

/**
 * Split a shell command line by top-level (unquoted) chain operators: `&&`, `||`, `;`.
 * Pipes (`|`) stay inside their segment so pipeline heads can still be inspected.
 */
export function splitShellChainRawSegments(command: string): string[] {
  const segments: string[] = []
  let quote: '"' | "'" | null = null
  let current = ''
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quote) {
      current += ch
      if (ch === quote && command[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (command.startsWith('&&', i) || command.startsWith('||', i)) {
      segments.push(current.trim())
      current = ''
      i += 1
      continue
    }
    if (ch === ';') {
      segments.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() || segments.length > 0) {
    segments.push(current.trim())
  }
  return segments.filter(Boolean)
}

/** True when the segment is a directory-changing builtin (`cd`, `pushd`, `Set-Location`, etc.). */
export function isDirectoryChangeSegment(segment: string): boolean {
  const tokens = tokenizeCommand(segment)
  if (tokens.length === 0) return false
  return DIRECTORY_CHANGE_BINARIES.has(normalizeBinary(tokens[0]!))
}

/**
 * Extract effective command segments from a shell command line.
 * Pure directory-change segments (`cd foo && npm test`) are skipped when followed by real commands,
 * because directory access is separately gated by `external_directory`.
 */
export function splitShellChainCommands(command: string): string[] {
  const unwrapped = unwrapWorkspaceCommandLine(command).replace(/\s+/g, ' ').trim()
  if (!unwrapped) return []
  const raw = splitShellChainRawSegments(unwrapped)
  const nonCd = raw.filter((seg) => !isDirectoryChangeSegment(seg))
  return nonCd.length > 0 ? nonCd : raw
}

/**
 * Tokenize a shell command for prefix matching.
 * Handles simple quotes; does not expand globs or run a real shell parser.
 */
export function tokenizeCommand(command: string): string[] {
  const tokens: string[] = []
  const re = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|[^\s]+/g
  let match: RegExpExecArray | null
  while ((match = re.exec(command)) != null) {
    let token = match[0]
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1)
    }
    if (token) tokens.push(token)
  }
  return tokens
}

function normalizeBinary(token: string): string {
  const base = token.replace(/^.*[/\\]/, '').toLowerCase()
  return base.replace(/\.exe$/i, '')
}

/** True when the command line chains/pipes multiple programs. */
export function commandHasShellOperators(command: string): boolean {
  // Ignore operators inside quotes by stripping quoted spans first.
  const stripped = command.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, ' ')
  return SHELL_OPERATOR_RE.test(stripped)
}

/**
 * Build an Always-reusable prefix pattern from argv tokens, e.g. `git status *`.
 * Returns null when Always must not persist a reusable pattern (caller should refuse Always
 * or fall back to Once-only semantics).
 */
export function resolveCommandPrefixPattern(tokens: string[]): string | null {
  if (tokens.length === 0) return null
  const binary = normalizeBinary(tokens[0]!)
  if (ALWAYS_FORBIDDEN_BINARIES.has(binary)) return null
  const arity = COMMAND_PREFIX_ARITY[binary] ?? 1
  if (tokens.length < arity) return null
  const take = Math.min(arity, tokens.length)
  const prefix = tokens
    .slice(0, take)
    .map((t, i) => (i === 0 ? binary : t))
    .join(' ')
  return `${prefix} *`
}

function stripOuterQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1).trim()
  }
  return value
}

function unwrapCmdOnce(command: string): string | null {
  const match = command.match(/^(?:cmd(?:\.exe)?)\s+(?:\/[a-z]\s+)*(\/c|\/k)\s+(.+)$/i)
  const inner = match?.[2]?.trim()
  if (!inner) return null
  return stripOuterQuotes(inner)
}

function unwrapPowerShellOnce(command: string): string | null {
  const tokens = tokenizeCommand(command)
  if (tokens.length < 3) return null
  const binary = normalizeBinary(tokens[0] ?? '')
  if (binary !== 'powershell' && binary !== 'pwsh') return null
  if (tokens.some((token) => /^-(encodedcommand|ec)$/i.test(token))) return null
  for (let i = 1; i < tokens.length; i++) {
    const flag = (tokens[i] ?? '').replace(/^-/, '').toLowerCase()
    if (flag === 'command' || flag === 'c') {
      const rest = tokens
        .slice(i + 1)
        .join(' ')
        .trim()
      return rest || null
    }
    if (flag === 'executionpolicy') i += 1
  }
  return null
}

/**
 * 工作台已经会按本机命令运行环境启动进程。模型再写一层启动器时，匹配和高风险看内层。
 * 不解开 bash/sh/zsh -c：那是解释器执行任意脚本，不能落可复用 Always。
 */
export function unwrapWorkspaceCommandLine(command: string): string {
  let current = command.replace(/\s+/g, ' ').trim()
  for (let depth = 0; depth < 2; depth++) {
    const next = unwrapCmdOnce(current) ?? unwrapPowerShellOnce(current)
    if (!next || next === current) break
    current = next
  }
  return current
}

export function unwrapWindowsCmdInvocation(command: string): string {
  return unwrapWorkspaceCommandLine(command)
}

/** 管道或分号前面的第一段命令，用来取命令头。 */
function firstShellSegment(command: string): string {
  let quote: '"' | "'" | null = null
  let segment = ''
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quote) {
      segment += ch
      if (ch === quote && command[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      segment += ch
      continue
    }
    if (command.startsWith('&&', i) || command.startsWith('||', i)) break
    if (ch === '|' || ch === ';' || ch === '`') break
    if (ch === '$' && command[i + 1] === '(') break
    segment += ch
  }
  return segment.trim()
}

function hasForbiddenPipeStage(segment: string): boolean {
  let quote: '"' | "'" | null = null
  const stages: string[] = []
  let current = ''
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i]!
    if (quote) {
      current += ch
      if (ch === quote && segment[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '|' && segment[i + 1] !== '|') {
      stages.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) stages.push(current.trim())
  if (stages.length <= 1) return false

  for (let i = 1; i < stages.length; i++) {
    const tokens = tokenizeCommand(stages[i]!)
    if (tokens.length === 0) continue
    const binary = normalizeBinary(tokens[0]!)
    if (ALWAYS_FORBIDDEN_BINARIES.has(binary)) return true
  }
  return false
}

export function resolveCommandPrefixPatternsFromCommand(command: string): string[] {
  const unwrapped = unwrapWorkspaceCommandLine(command).replace(/\s+/g, ' ').trim()
  if (!unwrapped) return []
  if (isDangerousShellCommand(unwrapped) || hasCommandSubstitution(unwrapped)) return []
  const segments = splitShellChainCommands(unwrapped)
  if (segments.length === 0) return []

  const patterns: string[] = []
  for (const seg of segments) {
    if (isDangerousShellCommand(seg) || hasForbiddenPipeStage(seg)) return []
    const headSource = commandHasShellOperators(seg) ? firstShellSegment(seg) : seg
    if (!headSource) return []
    const pattern = resolveCommandPrefixPattern(tokenizeCommand(headSource))
    if (!pattern) return []
    if (!patterns.includes(pattern)) {
      patterns.push(pattern)
    }
  }
  return patterns
}

export function resolveCommandPrefixPatternFromCommand(command: string): string | null {
  const patterns = resolveCommandPrefixPatternsFromCommand(command)
  return patterns[0] ?? null
}

/**
 * Whether this shell command may be permanently allowlisted at all.
 */
export function canPermanentlyAllowShellCommand(command: string): boolean {
  return resolveCommandPrefixPatternsFromCommand(command).length > 0
}

function matchSingleShellSegmentPattern(segment: string, pattern: string): boolean {
  const live = unwrapWorkspaceCommandLine(segment).replace(/\s+/g, ' ').trim()
  if (!live) return false
  if (commandHasShellOperators(live)) {
    if (
      isDangerousShellCommand(live) ||
      hasCommandSubstitution(live) ||
      hasForbiddenPipeStage(live)
    ) {
      return false
    }
    const head = firstShellSegment(live)
    if (!head) return false
    return matchSingleShellSegmentPattern(head, pattern)
  }

  const cmdTokens = tokenizeCommand(live)
  if (cmdTokens.length === 0) return false
  if (cmdTokens[0]) cmdTokens[0] = normalizeBinary(cmdTokens[0])

  const trimmed = unwrapWorkspaceCommandLine(pattern)
  if (!trimmed) return false
  // Reject over-broad patterns like bare `*` or `* *`
  if (trimmed === '*' || trimmed === '* *') return false

  const hasWildcard = trimmed.endsWith(' *')
  const patternBody = hasWildcard ? trimmed.slice(0, -2).trim() : trimmed
  const patternTokens = tokenizeCommand(patternBody)
  if (patternTokens.length === 0) return false
  if (patternTokens[0]) patternTokens[0] = normalizeBinary(patternTokens[0])

  const patternBinary = patternTokens[0]!
  if (ALWAYS_FORBIDDEN_BINARIES.has(patternBinary) && hasWildcard) {
    // Stale allowlist entries like `python *` / `rm *` must not match.
    return false
  }

  if (cmdTokens.length < patternTokens.length) return false
  for (let i = 0; i < patternTokens.length; i++) {
    if (cmdTokens[i] !== patternTokens[i]) return false
  }
  if (!hasWildcard && cmdTokens.length !== patternTokens.length) return false
  return true
}

/**
 * Match a live command against an allowlist/permission pattern.
 * - Pattern ending with ` *` matches that command head, including a later pipeline that starts with it
 * - Compound commands (`&&`, `||`, `;`) strip pure `cd` segments and require every command segment to match
 * - Pattern without `*` requires exact token-prefix equality (same arity length)
 * - A pattern that itself contains pipes or separators matches only that exact command line
 * - Never matches by raw substring of the full command string
 */
export function matchShellCommandPattern(command: string, pattern: string): boolean {
  const live = unwrapWorkspaceCommandLine(command).replace(/\s+/g, ' ').trim()
  const trimmedPattern = unwrapWorkspaceCommandLine(pattern).replace(/\s+/g, ' ').trim()
  if (commandHasShellOperators(trimmedPattern)) {
    if (isDangerousShellCommand(live) || isDangerousShellCommand(trimmedPattern)) return false
    return live === trimmedPattern
  }
  if (isDangerousShellCommand(live) || hasCommandSubstitution(live)) return false

  const segments = splitShellChainCommands(live)
  if (segments.length === 0) return false
  return segments.every((seg) => matchSingleShellSegmentPattern(seg, pattern))
}

export function isDangerousShellCommand(command: string): boolean {
  const normalized = unwrapWorkspaceCommandLine(command)
  if (!normalized) return false
  if (
    commandHasShellOperators(normalized) &&
    /\|/.test(normalized.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, ' '))
  ) {
    // Piped to shell interpreters is covered by DANGEROUS patterns; chaining alone is not
    // "dangerous" for forceExclusion but blocks Always/allowlist match separately.
  }
  return DANGEROUS_SHELL_PATTERNS.some((re) => re.test(normalized))
}

export interface AllowlistMatchInput {
  action: string
  resources?: ReadonlyArray<{ kind: string; value: string }>
}

/**
 * True when an allowlist entry covers this assert.
 * - No pattern: whole-action allow (legacy) — except workspace_run which requires a pattern
 * - With pattern + shell_command: structured prefix match
 * - With pattern + path kinds: glob-style via simple `*` suffix / exact
 */
export function allowlistEntryMatches(
  entry: { action: string; pattern?: string; resourceKind?: string },
  input: AllowlistMatchInput
): boolean {
  if (entry.action !== input.action) return false

  // Shell tool must never be whole-action allowlisted.
  if (input.action === 'workspace_run' && !entry.pattern) return false

  if (!entry.pattern) return true

  const kind =
    entry.resourceKind ?? (input.action === 'workspace_run' ? 'shell_command' : undefined)
  const resources = input.resources ?? []

  if (kind === 'shell_command' || input.action === 'workspace_run') {
    const candidates = resources.filter((r) => r.kind === 'shell_command').map((r) => r.value)
    if (candidates.length === 0) return false
    return candidates.some((cmd) => matchShellCommandPattern(cmd, entry.pattern!))
  }

  const pathKind = kind ?? 'workspace_path'
  const candidates = resources.filter((r) => r.kind === pathKind).map((r) => r.value)
  if (candidates.length === 0) return false

  // Path-like: support trailing /** or * as prefix match; otherwise exact
  const pattern = entry.pattern.replace(/\\/g, '/')
  if (pattern === '*' || pattern === '**' || pattern === '**/*') return false
  return candidates.some((value) => {
    const v = value.replace(/\\/g, '/')
    if (pattern.endsWith('/**')) {
      const base = pattern.slice(0, -3)
      return v === base || v.startsWith(`${base}/`)
    }
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2)
      return v === base || (v.startsWith(`${base}/`) && !v.slice(base.length + 1).includes('/'))
    }
    if (pattern.endsWith('*') && !pattern.includes('/')) {
      return v.startsWith(pattern.slice(0, -1))
    }
    return v === pattern
  })
}
