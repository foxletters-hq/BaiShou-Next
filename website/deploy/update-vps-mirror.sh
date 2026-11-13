#!/usr/bin/env bash
# 把构建结果同步到 1Panel（对外主站 foxletters.com）
# 用法（在 BaiShou-Next 根目录或 website 目录）:
#   ./website/deploy/update-vps-mirror.sh
#   SITE_PATH=/opt/1panel/www/sites/foxletters.com/index ./website/deploy/update-vps-mirror.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE_PATH="${SITE_PATH:-/opt/1panel/www/sites/foxletters.com/index}"

cd "$ROOT"

echo "==> 更新代码"
git pull --ff-only

echo "==> 安装依赖"
pnpm install --frozen-lockfile

echo "==> 构建"
pnpm run build

if [[ ! -d dist ]]; then
  echo "构建失败：没有 dist/ 目录" >&2
  exit 1
fi

if [[ ! -d "$SITE_PATH" ]]; then
  echo "站点目录不存在: $SITE_PATH" >&2
  echo "请先在 1Panel 创建静态网站，或设置 SITE_PATH" >&2
  exit 1
fi

echo "==> 同步到 $SITE_PATH"
rsync -a --delete dist/ "${SITE_PATH}/"

echo "完成。已同步到主站目录 $SITE_PATH 。"
