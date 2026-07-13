# 在克隆目录内任意位置执行均可；自动定位仓库根目录
# 本地与 GitHub Actions 使用同一套检查（见 .github/workflows/ci.yml）
$ErrorActionPreference = 'Stop'
$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { throw '请在 BaiShou-Next 仓库目录内运行此脚本' }

Push-Location $root
try {
  pnpm install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm sync:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm audit:cache-invalidation
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm --filter @baishou/mobile run build:diary-editor
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm lint
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm format:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # 单测可能把 better-sqlite3 编成系统 Node ABI；收尾按 Electron ABI 恢复，减少下次开桌面时的重编。
  # 若桌面端正在运行导致文件占用，仅警告：下次 `pnpm dev:desktop` 的 ensure:native 仍会自动重试。
  Write-Host ''
  Write-Host '正在按 Electron ABI 校验/恢复桌面原生模块…'
  pnpm --filter @baishou/desktop run ensure:native
  if ($LASTEXITCODE -ne 0) {
    Write-Host '警告: 未能恢复 Electron 原生模块（常见原因：桌面端正在运行占用 .node）。下次启动桌面端会自动重试。' -ForegroundColor Yellow
  }

  Write-Host ''
  Write-Host '正在校验移动端原生预置（sqlite-vec / 真机 ABI）…'
  pnpm --filter @baishou/mobile run ensure:native
  if ($LASTEXITCODE -ne 0) {
    Write-Host '警告: 移动端原生检查未通过。无设备时多为配置问题；有设备时请 pnpm dev:mobile:clear 重装开发版。' -ForegroundColor Yellow
  }

  Write-Host ''
  Write-Host 'CI 本地检查全部通过。' -ForegroundColor Green
}
finally {
  Pop-Location
}
