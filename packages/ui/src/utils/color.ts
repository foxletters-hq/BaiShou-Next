import { colord } from 'colord';

export function getPrimaryDarkColor(seedColorHex: string): string {
  const c = colord(seedColorHex);
  if (!c.isValid()) return seedColorHex;

  const hsl = c.toHsl();
  
  // From app_theme.dart:
  // lightness - 0.25 (clamp 0.2, 0.5)
  // saturation + 0.15 (clamp 0.0, 1.0)
  const l = Math.min(0.5, Math.max(0.2, (hsl.l / 100) - 0.25));
  const s = Math.min(1.0, Math.max(0.0, (hsl.s / 100) + 0.15));

  return colord({ h: hsl.h, s: s * 100, l: l * 100 }).toHex();
}
