#!/usr/bin/env bash
# 在克隆目录内任意位置执行均可；自动定位仓库根目录
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo '请在 BaiShou-Next 仓库目录内运行此脚本' >&2
  exit 1
}

cd "$root"

# 与 GitHub Actions 一致使用 Node 22（避免 better-sqlite3 等原生模块 ABI 不匹配）
ci_node_major=22
if [ "$(node -p "process.versions.node.split('.')[0]")" != "$ci_node_major" ]; then
  if [ -n "${NVM_DIR:-}" ] && [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  elif [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
  fi
  if command -v nvm >/dev/null 2>&1; then
    nvm use "$ci_node_major" >/dev/null 2>&1 || true
  fi
fi
if [ "$(node -p "process.versions.node.split('.')[0]")" != "$ci_node_major" ]; then
  echo "警告: CI 使用 Node ${ci_node_major}，当前为 $(node -v)。请切换后再跑，否则原生依赖测试可能失败。" >&2
fi

pnpm install
pnpm sync:icons:check
pnpm typecheck
pnpm turbo run test --continue
pnpm --filter @baishou/desktop exec eslint -c ../../eslint.desktop.ci.mjs . --cache --quiet
pnpm --filter @baishou/mobile exec eslint -c ../../eslint.mobile.ci.mjs . --cache --quiet
pnpm format:check

echo ''
echo 'CI 本地检查全部通过。'
