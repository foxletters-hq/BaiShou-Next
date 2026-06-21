export type GitSpawnEnv = Record<string, string | undefined>

export interface GitBinaryProvider {
  getBinary: () => string
  getSpawnEnv: (extra?: GitSpawnEnv) => { env: GitSpawnEnv; gitBinary: string }
  applyProcessEnv?: () => void
}

let provider: GitBinaryProvider = {
  getBinary: () => 'git',
  getSpawnEnv: (extra = {}) => ({
    env: { ...process.env, ...extra } as GitSpawnEnv,
    gitBinary: 'git'
  })
}

let processEnvApplied = false

export function configureGitBinaryProvider(next: GitBinaryProvider): void {
  provider = next
  processEnvApplied = false
}

export function applyGitProcessEnv(): void {
  if (processEnvApplied) return
  provider.applyProcessEnv?.()
  processEnvApplied = true
}

export function getBundledGitBinary(): string {
  return provider.getBinary()
}

export function getBundledGitSpawnEnv(
  extra: GitSpawnEnv = {}
): { env: GitSpawnEnv; gitBinary: string } {
  return provider.getSpawnEnv(extra)
}
