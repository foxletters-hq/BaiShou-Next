// 图片解析工具函数

export interface ParsedImage {
  alt: string;
  src: string;
  width?: number;
  from: number;
  to: number;
}

export const IMAGE_SIZE_CONFIG = {
  minWidth: 100,
  maxWidth: 1200,
  step: 10,
};

const IMAGE_REGEX = /!\[([^\]]*)\]\(([^ |)]+)(?:\s*\|\s*(\d+))?\)/;

export function parseImageMarkdown(text: string, offset: number = 0): ParsedImage | null {
  const match = text.match(IMAGE_REGEX);
  if (!match) return null;

  const alt = match[1] ?? '';
  const src = match[2] ?? '';
  const widthStr = match[3];
  const width = widthStr ? parseInt(widthStr, 10) : undefined;

  return {
    alt,
    src,
    width: width && !isNaN(width) && width > 0 ? width : undefined,
    from: offset,
    to: offset + match[0].length,
  };
}

export function buildImageMarkdown(alt: string, src: string, width?: number): string {
  if (width !== undefined) {
    return `![${alt}](${src} | ${width})`;
  }
  return `![${alt}](${src})`;
}

export function clampWidth(
  width: number,
  min: number = IMAGE_SIZE_CONFIG.minWidth,
  max: number = IMAGE_SIZE_CONFIG.maxWidth,
): number {
  return Math.max(min, Math.min(max, width));
}
