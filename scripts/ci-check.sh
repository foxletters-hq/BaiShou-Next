#!/usr/bin/env bash
# 在克隆目录内任意位置执行均可；自动定位仓库根目录
# 本地与 GitHub Actions 使用同一套检查（见 .github/workflows/ci.yml）
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

pnpm install --frozen-lockfile
pnpm sync:check
pnpm typecheck
pnpm audit:cache-invalidation
pnpm test
pnpm --filter @baishou/mobile run build:diary-editor
pnpm lint
pnpm format:check

# 单测可能把 better-sqlite3 编成系统 Node ABI；收尾按 Electron ABI 恢复，减少下次开桌面时的重编。
# 若桌面端正在运行导致文件占用，仅警告：下次 `pnpm dev:desktop` 的 ensure:native 仍会自动重试。
echo ''
echo '正在按 Electron ABI 校验/恢复桌面原生模块…'
if ! pnpm --filter @baishou/desktop run ensure:native; then
  echo "警告: 未能恢复 Electron 原生模块（常见原因：桌面端正在运行占用 .node）。下次启动桌面端会自动重试。" >&2
fi

echo ''
echo 'CI 本地检查全部通过。'
