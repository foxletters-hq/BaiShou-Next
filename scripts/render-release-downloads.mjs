#!/usr/bin/env node
/**
 * 生成 Release 说明中的「各平台最新下载」Markdown 表格。
 * 版本号来自各端 version.json，链接按 v{semver} Release tag 拼接。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  OFFICIAL_WEBSITE_URL,
  RELEASE_ARTIFACTS,
  releaseDownloadUrl
} from './release-constants.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readVersion(app) {
  const path = join(root, 'apps', app, 'src/version.json')
  return JSON.parse(readFileSync(path, 'utf8')).version
}

export function renderReleaseDownloadsMarkdown({
  repo = 'foxletters-hq/BaiShou-Next',
  mobileVersion = readVersion('mobile'),
  desktopVersion = readVersion('desktop'),
  websiteUrl = OFFICIAL_WEBSITE_URL
} = {}) {
  const androidUrl = releaseDownloadUrl(repo, mobileVersion, RELEASE_ARTIFACTS.android)
  const windowsUrl = releaseDownloadUrl(repo, desktopVersion, RELEASE_ARTIFACTS.windows)

  return [
    '## 各平台最新下载',
    '',
    '| 平台 | 当前版本 | 下载 |',
    '|------|----------|------|',
    `| Android | ${mobileVersion} | [下载 APK](${androidUrl}) |`,
    `| Windows | ${desktopVersion} | [下载安装包](${windowsUrl}) |`,
    '',
    `**[官网下载（推荐）](${websiteUrl})** — 自动匹配各端最新版本。`,
    ''
  ].join('\n')
}

function main() {
  const repoIdx = process.argv.indexOf('--repo')
  const repo = repoIdx >= 0 ? process.argv[repoIdx + 1] : 'foxletters-hq/BaiShou-Next'
  console.log(renderReleaseDownloadsMarkdown({ repo }))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
