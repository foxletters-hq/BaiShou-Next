import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

export function listPlatformTags(platform) {
  const out = git(['tag', '-l', `${platform}/v*`, '--sort=-v:refname'])
  return out ? out.split('\n').filter(Boolean) : []
}

/** 上一分端发版 tag，供 generate_release_notes 的 previous_tag 使用 */
export function resolvePreviousPlatformTag(platform, version) {
  const current = `${platform}/v${version}`
  const tags = listPlatformTags(platform)
  const idx = tags.indexOf(current)
  if (idx >= 0 && tags[idx + 1]) return tags[idx + 1]
  return tags.find((tag) => tag !== current)
}
