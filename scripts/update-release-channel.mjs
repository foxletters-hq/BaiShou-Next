#!/usr/bin/env node
/**
 * 发版 CI 写入 releases/channel.json（各端独立版本与下载直链）。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const channelPath = join(root, 'releases/channel.json')

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag) => {
    const i = args.indexOf(flag)
    return i >= 0 ? args[i + 1] : undefined
  }
  const platform = get('--platform')
  const version = get('--version')
  const tag = get('--tag')
  const repo = get('--repo') || 'foxletters-hq/BaiShou-Next'
  const versionCode = get('--version-code')
  if (!platform || !version || !tag) {
    console.error('用法: update-release-channel.mjs --platform android|windows --version 1.2.3 --tag mobile/v1.2.3 [--version-code 80]')
    process.exit(1)
  }
  return { platform, version, tag, repo, versionCode }
}

const { platform, version, tag, repo, versionCode } = parseArgs()
const channel = JSON.parse(readFileSync(channelPath, 'utf8'))

const base = `https://github.com/${repo}/releases/download/${tag}`
if (platform === 'android') {
  channel.android = {
    version,
    ...(versionCode ? { versionCode: Number(versionCode) } : {}),
    tag,
    artifact: 'BaiShou-Android.apk',
    downloadUrl: `${base}/BaiShou-Android.apk`
  }
} else if (platform === 'windows') {
  channel.windows = {
    version,
    tag,
    artifact: 'BaiShou-Windows-Setup.exe',
    downloadUrl: `${base}/BaiShou-Windows-Setup.exe`
  }
} else {
  console.error(`未知 platform: ${platform}`)
  process.exit(1)
}

channel.updatedAt = new Date().toISOString()
writeFileSync(channelPath, `${JSON.stringify(channel, null, 2)}\n`)
console.log(`[update-release-channel] ${platform} -> ${version} (${tag})`)
