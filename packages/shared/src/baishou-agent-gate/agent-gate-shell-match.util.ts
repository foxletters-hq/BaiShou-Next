/**
 * Structured shell-command matching for Agent Gate (G3).
 * Prefer argv prefix + arity over substring globs so `rm` never matches `harmless`.
 */

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
  python: 1,
  python3: 1,
  node: 1,
  deno: 1,
  rm: 1,
  rmdir: 1,
  del: 1,
  erase: 1,
  rd: 1,
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
  curl: 1,
  wget: 1,
  ssh: 1,
  scp: 1,
  tar: 1,
  zip: 1,
  unzip: 1,
  powershell: 1,
  pwsh: 1,
  cmd: 1,
  bash: 1,
  sh: 1
}

/** Patterns that must never be Always-allowlisted (force Ask / exclusion). */
const DANGEROUS_SHELL_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-rf|-fr)\b/i,
  /\bdel\s+\/s\b/i,
  /\brd\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\s+[a-z]:/i,
  /\bmkfs(\.|$|\s)/i,
  /\bdd\s+.*\bif=/i,
  /\b(Remove-Item|ri)\b.*\b-Recurse\b/i,
  /\b(Remove-Item|ri)\b.*\b-Force\b.*\b-Recurse\b/i,
  /\bcipher\s+\/w\b/i,
  /\bdiskpart\b/i,
  /\breg\s+delete\b/i,
  /\bshutdown\b/i,
  /\b(Invoke-Expression|iex)\b/i
]

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

/**
 * Build an Always-reusable prefix pattern from argv tokens, e.g. `git status *`.
 */
export function resolveCommandPrefixPattern(tokens: string[]): string | null {
  if (tokens.length === 0) return null
  const binary = normalizeBinary(tokens[0]!)
  const arity = COMMAND_PREFIX_ARITY[binary] ?? 1
  const take = Math.min(arity, tokens.length)
  const prefix = tokens.slice(0, take).map((t, i) => (i === 0 ? binary : t)).join(' ')
  return `${prefix} *`
}

export function resolveCommandPrefixPatternFromCommand(command: string): string | null {
  return resolveCommandPrefixPattern(tokenizeCommand(command))
}

/**
 * Match a live command against an allowlist/permission pattern.
 * - Pattern ending with ` *` matches that exact prefix then anything
 * - Pattern without `*` requires exact token-prefix equality (same arity length)
 * - Never matches by raw substring of the full command string
 */
export function matchShellCommandPattern(command: string, pattern: string): boolean {
  const cmdTokens = tokenizeCommand(command)
  if (cmdTokens.length === 0) return false
  if (cmdTokens[0]) cmdTokens[0] = normalizeBinary(cmdTokens[0])

  const trimmed = pattern.trim()
  if (!trimmed) return false

  const hasWildcard = trimmed.endsWith(' *')
  const patternBody = hasWildcard ? trimmed.slice(0, -2).trim() : trimmed
  const patternTokens = tokenizeCommand(patternBody)
  if (patternTokens.length === 0) return false
  if (patternTokens[0]) patternTokens[0] = normalizeBinary(patternTokens[0])

  if (cmdTokens.length < patternTokens.length) return false
  for (let i = 0; i < patternTokens.length; i++) {
    if (cmdTokens[i] !== patternTokens[i]) return false
  }
  if (!hasWildcard && cmdTokens.length !== patternTokens.length) return false
  return true
}

export function isDangerousShellCommand(command: string): boolean {
  const normalized = command.replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  return DANGEROUS_SHELL_PATTERNS.some((re) => re.test(normalized))
}

export interface AllowlistMatchInput {
  action: string
  resources?: ReadonlyArray<{ kind: string; value: string }>
}

/**
 * True when an allowlist entry covers this assert.
 * - No pattern: whole-action allow (legacy)
 * - With pattern + shell_command: structured prefix match
 * - With pattern + path kinds: glob-style via simple `*` suffix / exact
 */
export function allowlistEntryMatches(
  entry: { action: string; pattern?: string; resourceKind?: string },
  input: AllowlistMatchInput
): boolean {
  if (entry.action !== input.action) return false
  if (!entry.pattern) return true

  const kind = entry.resourceKind ?? 'shell_command'
  const resources = input.resources ?? []
  const candidates = resources.filter((r) => r.kind === kind).map((r) => r.value)
  if (candidates.length === 0) return false

  if (kind === 'shell_command') {
    return candidates.some((cmd) => matchShellCommandPattern(cmd, entry.pattern!))
  }

  // Path-like: support trailing /** or * as prefix match; otherwise exact
  const pattern = entry.pattern.replace(/\\/g, '/')
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
