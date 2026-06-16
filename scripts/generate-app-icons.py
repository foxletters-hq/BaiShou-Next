#!/usr/bin/env python3
"""从品牌源图生成各端应用图标。

源图：packages/shared/assets/images/app-brand-icon-source.png（1024×1024 推荐）
输出：
  - apps/mobile/assets/images/icon.png（方角，移动端 / 应用内）
  - packages/shared/assets/images/icon.png（与 mobile 一致）
  - apps/desktop/resources/icon.png（圆角透明底，任务栏 / 窗口）
  - favicon、splash、Android mipmap 等衍生资源
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw

CANVAS = 1024
SAFE_RATIO = float(os.environ.get('ANDROID_ICON_SAFE_RATIO', '0.92'))
DESKTOP_CORNER_RADIUS_RATIO = float(os.environ.get('DESKTOP_ICON_CORNER_RATIO', '0.22'))
WHITE_TRIM_THRESHOLD = int(os.environ.get('ANDROID_ICON_WHITE_TRIM', '250'))

LAUNCHER_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}
FG_SIZES = {
    'mipmap-mdpi': 108,
    'mipmap-hdpi': 162,
    'mipmap-xhdpi': 216,
    'mipmap-xxhdpi': 324,
    'mipmap-xxxhdpi': 432,
}


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def default_source() -> Path:
    return repo_root() / 'packages/shared/assets/images/app-brand-icon-source.png'


def load_square_source(path: Path) -> Image.Image:
    img = Image.open(path).convert('RGBA')
    if img.size != (CANVAS, CANVAS):
        img = img.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)
    return img


def trim_near_white(img: Image.Image, threshold: int = WHITE_TRIM_THRESHOLD) -> Image.Image:
    rgba = img.convert('RGBA')
    width, height = rgba.size
    pixels = rgba.load()
    min_x, min_y, max_x, max_y = width, height, 0, 0
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
    return rgba.crop((min_x, min_y, max_x + 1, max_y + 1)) if found else rgba


def fit_on_canvas(
    img: Image.Image,
    canvas_size: int,
    safe_ratio: float,
    *,
    trim_white: bool,
) -> Image.Image:
    trimmed = trim_near_white(img) if trim_white else img.convert('RGBA')
    target_max = int(canvas_size * safe_ratio)
    sw, sh = trimmed.size
    scale = min(target_max / sw, target_max / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    logo = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(logo, ((canvas_size - nw) // 2, (canvas_size - nh) // 2), logo)
    return canvas


def apply_rounded_corners(img: Image.Image, radius: int) -> Image.Image:
    rgba = img.convert('RGBA')
    w, h = rgba.size
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=radius, fill=255)
    rounded = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    rounded.paste(rgba, (0, 0), mask)
    return rounded


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format='PNG', optimize=True)


def generate_all(source: Path) -> None:
    root = repo_root()
    square = load_square_source(source)
    radius = max(1, int(CANVAS * DESKTOP_CORNER_RADIUS_RATIO))
    desktop = apply_rounded_corners(square, radius)

    mobile_assets = root / 'apps/mobile/assets/images'
    android_res = root / 'apps/mobile/android/app/src/main/res'

    save_png(square, mobile_assets / 'icon.png')
    save_png(square, root / 'packages/shared/assets/images/icon.png')
    save_png(desktop, root / 'apps/desktop/resources/icon.png')

    square_rgb = square.convert('RGB')
    square_rgb.resize((48, 48), Image.Resampling.LANCZOS).save(
        mobile_assets / 'favicon.png', format='PNG', optimize=True
    )

    fit_on_canvas(square, CANVAS, SAFE_RATIO, trim_white=False).save(
        mobile_assets / 'splash-icon.png', format='PNG', optimize=True
    )
    fit_on_canvas(square, CANVAS, SAFE_RATIO, trim_white=False).save(
        mobile_assets / 'android-icon-foreground.png', format='PNG', optimize=True
    )

    if android_res.is_dir():
        for folder, size in LAUNCHER_SIZES.items():
            square_rgb.resize((size, size), Image.Resampling.LANCZOS).save(
                android_res / folder / 'ic_launcher.webp', format='WEBP', quality=90
            )
        for folder, size in FG_SIZES.items():
            fit_on_canvas(square, size, SAFE_RATIO, trim_white=False).save(
                android_res / folder / 'ic_launcher_foreground.webp', format='WEBP', quality=90
            )

    print(f'[generate-app-icons] source: {source}')
    print(f'[generate-app-icons] mobile/shared: {CANVAS}² square')
    print(f'[generate-app-icons] desktop: corner radius {radius}px (ratio={DESKTOP_CORNER_RADIUS_RATIO})')


def main() -> int:
    source = Path(sys.argv[1]) if len(sys.argv) >= 2 else default_source()
    if not source.is_file():
        print(f'[generate-app-icons] 源文件不存在: {source}', file=sys.stderr)
        return 1
    generate_all(source)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
