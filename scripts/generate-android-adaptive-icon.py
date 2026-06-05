#!/usr/bin/env python3
"""从 app icon 生成 Android Adaptive Icon 前景图（裁白边、缩至安全区、居中）。"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from PIL import Image

CANVAS = 1024
# 比官方 66/108 略小，接近 Flutter flutter_launcher_icons 在桌面上的观感
DEFAULT_SAFE_RATIO = float(os.environ.get('ANDROID_ICON_SAFE_RATIO', '0.50'))
WHITE_TRIM_THRESHOLD = int(os.environ.get('ANDROID_ICON_WHITE_TRIM', '250'))


def trim_near_white(img: Image.Image, threshold: int = WHITE_TRIM_THRESHOLD) -> Image.Image:
    """去掉纯白边距，避免特写图在 adaptive icon 里显得过大。"""
    rgba = img.convert('RGBA')
    width, height = rgba.size
    pixels = rgba.load()

    min_x, min_y = width, height
    max_x, max_y = 0, 0
    found = False

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a < 16:
                continue
            if r >= threshold and g >= threshold and b >= threshold:
                continue
            found = True
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)

    if not found:
        return rgba

    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1))


def generate_foreground(source: Path, output: Path, safe_ratio: float = DEFAULT_SAFE_RATIO) -> None:
    source_img = trim_near_white(Image.open(source))
    target_max = int(CANVAS * safe_ratio)

    src_w, src_h = source_img.size
    scale = min(target_max / src_w, target_max / src_h)
    new_w = max(1, int(src_w * scale))
    new_h = max(1, int(src_h * scale))
    logo = source_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = ((CANVAS - new_w) // 2, (CANVAS - new_h) // 2)
    canvas.paste(logo, offset, logo)
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format='PNG', optimize=True)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    source = repo_root / 'apps/mobile/assets/images/icon.png'
    output = repo_root / 'apps/mobile/assets/images/android-icon-foreground.png'

    if len(sys.argv) >= 3:
        source = Path(sys.argv[1])
        output = Path(sys.argv[2])

    if not source.is_file():
        print(f'[generate-android-adaptive-icon] 源文件不存在: {source}', file=sys.stderr)
        return 1

    generate_foreground(source, output)
    print(f'[generate-android-adaptive-icon] {output} (safe_ratio={DEFAULT_SAFE_RATIO})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
