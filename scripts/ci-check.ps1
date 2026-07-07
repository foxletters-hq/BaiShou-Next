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

  Write-Host ''
  Write-Host 'CI 本地检查全部通过。' -ForegroundColor Green
}
finally {
  Pop-Location
}
