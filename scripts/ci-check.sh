#!/usr/bin/env bash
# 在克隆目录内任意位置执行均可；自动定位仓库根目录
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo '请在 BaiShou-Next 仓库目录内运行此脚本' >&2
  exit 1
}

cd "$root"

pnpm install
pnpm typecheck
pnpm turbo run test --continue
pnpm --filter @baishou/desktop exec eslint -c ../../eslint.desktop.ci.mjs . --cache --quiet
pnpm --filter @baishou/mobile exec eslint -c ../../eslint.mobile.ci.mjs . --cache --quiet
pnpm format:check

echo ''
echo 'CI 本地检查全部通过。'
