import { createRequire } from 'node:module'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { resolveGitBinary, setupEnvironment } from 'dugite'
import { configureGitBinaryProvider } from '@baishou/core/desktop'

const require = createRequire(__filename)

let cachedGitDir: string | null = null
let cachedGitBinary: string | null = null

/**
 * 解析 dugite 内置 Git 目录。
 * 不能依赖 dugite 内部的 __dirname（dev 打包后 __dirname 会落在 out/main，路径会错）。
 */
function resolveDugiteGitDirectory(): string {
  if (cachedGitDir) return cachedGitDir

  const dugitePackageRoot = path.dirname(require.resolve('dugite/package.json'))
  const gitDir = path.join(dugitePackageRoot, 'git').replace(
    /[\\/]app\.asar([\\/])/,
    `${path.sep}app.asar.unpacked$1`
  )

  const gitBinary =
    process.platform === 'win32'
      ? path.join(gitDir, 'cmd', 'git.exe')
      : path.join(gitDir, 'bin', 'git')

  if (!fs.existsSync(gitBinary)) {
    throw new Error(
      `内置 Git 未找到: ${gitBinary}。请在仓库根目录执行 pnpm install，或运行 node node_modules/dugite/script/download-git.js`
    )
  }

  cachedGitDir = gitDir
  return gitDir
}

/** 注册 dugite 内置 Git（桌面端主进程启动时调用一次） */
export function registerDugiteGitBinary(): void {
  configureGitBinaryProvider({
    getBinary: () => {
      if (!cachedGitBinary) {
        const gitDir = resolveDugiteGitDirectory()
        cachedGitBinary = resolveGitBinary(gitDir)
      }
      return cachedGitBinary
    },
    getSpawnEnv: (extra = {}) => {
      const gitDir = resolveDugiteGitDirectory()
      const { env, gitLocation } = setupEnvironment({
        ...extra,
        LOCAL_GIT_DIRECTORY: gitDir
      })
      return { env, gitBinary: gitLocation }
    },
    applyProcessEnv: () => {
      const gitDir = resolveDugiteGitDirectory()
      process.env.LOCAL_GIT_DIRECTORY = gitDir
      const { env } = setupEnvironment({ LOCAL_GIT_DIRECTORY: gitDir })
      for (const [key, value] of Object.entries(env)) {
        if (value !== undefined) {
          process.env[key] = value
        }
      }
    }
  })
}
