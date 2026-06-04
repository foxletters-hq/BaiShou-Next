# 在克隆目录内任意位置执行均可；自动定位仓库根目录
$ErrorActionPreference = 'Stop'
$root = git rev-parse --show-toplevel 2>$null
if (-not $root) { throw '请在 BaiShou-Next 仓库目录内运行此脚本' }

Push-Location $root
try {
  pnpm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm sync:icons:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm typecheck
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm turbo run test --continue
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm --filter @baishou/desktop exec eslint -c ../../eslint.desktop.ci.mjs . --cache --quiet
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm --filter @baishou/mobile exec eslint -c ../../eslint.mobile.ci.mjs . --cache --quiet
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  pnpm format:check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host ''
  Write-Host 'CI 本地检查全部通过。' -ForegroundColor Green
}
finally {
  Pop-Location
}
