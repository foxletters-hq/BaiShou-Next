#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

const GIST_ID = process.env.CLA_GIST_ID || '1cf4a03edad406bae5e96ff5d38a4e51'
const claFilePath = path.join(rootDir, 'legal', 'CLA-organization.md')

if (!fs.existsSync(claFilePath)) {
  console.error(`[sync-cla-gist] 错误：未找到协议文件 ${claFilePath}`)
  process.exit(1)
}

const claContent = fs.readFileSync(claFilePath, 'utf8')
const token = process.env.GIST_PAT || process.env.GIST_TOKEN || process.env.GITHUB_TOKEN

const payload = {
  description: 'Foxletters / 白守 组织级个人贡献者许可协议 (CLA)',
  files: {
    'CLA-organization.md': { content: claContent },
    'BaiShou-Next Individual CLA v1.0.txt': { content: claContent }
  }
}

async function updateViaFetch(authToken) {
  const url = `https://api.github.com/gists/${GIST_ID}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${authToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'BaiShou-CLA-Sync-Script'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`GitHub API HTTP ${res.status}: ${errorText}`)
  }
  return await res.json()
}

function updateViaGhCli() {
  const tmpFile = path.join(rootDir, `.tmp_gist_sync_${Date.now()}.json`)
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8')
    execSync(`gh api -X PATCH gists/${GIST_ID} --input "${tmpFile}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    })
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile)
    }
  }
}

async function main() {
  console.log(`[sync-cla-gist] 正在同步 CLA 协议到 Gist (${GIST_ID})...`)
  if (token && token.trim() !== '') {
    try {
      await updateViaFetch(token.trim())
      console.log(`[sync-cla-gist] ✅ 成功通过 API Token 同步 Gist 协议内容！`)
      return
    } catch (err) {
      console.warn(`[sync-cla-gist] ⚠️ Token 请求失败 (${err.message})，尝试回退使用 gh cli...`)
    }
  }

  try {
    updateViaGhCli()
    console.log(`[sync-cla-gist] ✅ 成功通过 gh CLI 同步 Gist 协议内容！`)
  } catch (err) {
    console.error(`[sync-cla-gist] ❌ 同步失败: ${err.message}`)
    console.error(
      `提示：在 GitHub Actions 中请配置拥有 gist 权限的 Secret (GIST_PAT)；在本地请确保已登录 gh cli (gh auth status)。`
    )
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[sync-cla-gist] 未知异常:', err)
  process.exit(1)
})
