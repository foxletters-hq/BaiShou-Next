import { describe, it, expect } from 'vitest';
import { parseImageMarkdown, buildImageMarkdown, clampWidth } from '../image-utils';

describe('parseImageMarkdown', () => {
  it('should parse image with width', () => {
    const result = parseImageMarkdown('![alt text](image.png | 500)', 0);
    expect(result).toEqual({
      alt: 'alt text',
      src: 'image.png',
      width: 500,
      from: 0,
      to: 28,
    });
  });

  it('should parse image without width', () => {
    const result = parseImageMarkdown('![alt](image.png)', 0);
    expect(result).toEqual({
      alt: 'alt',
      src: 'image.png',
      width: undefined,
      from: 0,
      to: 17,
    });
  });

  it('should parse image with empty alt', () => {
    const result = parseImageMarkdown('![](image.png | 800)', 0);
    expect(result).toEqual({
      alt: '',
      src: 'image.png',
      width: 800,
      from: 0,
      to: 20,
    });
  });

  it('should return null for invalid markdown', () => {
    const result = parseImageMarkdown('not an image', 0);
    expect(result).toBeNull();
  });

  it('should return null for invalid width', () => {
    const result = parseImageMarkdown('![alt](image.png | abc)', 0);
    expect(result).toBeNull();
  });

  it('should handle offset correctly', () => {
    const result = parseImageMarkdown('![alt](image.png | 500)', 10);
    expect(result).toEqual({
      alt: 'alt',
      src: 'image.png',
      width: 500,
      from: 10,
      to: 33,
    });
  });
});

describe('buildImageMarkdown', () => {
  it('should build image with width', () => {
    const result = buildImageMarkdown('alt', 'image.png', 500);
    expect(result).toBe('![alt](image.png | 500)');
  });

  it('should build image without width', () => {
    const result = buildImageMarkdown('alt', 'image.png');
    expect(result).toBe('![alt](image.png)');
  });

  it('should build image with empty alt', () => {
    const result = buildImageMarkdown('', 'image.png', 800);
    expect(result).toBe('![](image.png | 800)');
  });
});

describe('clampWidth', () => {
  it('should clamp width to minimum', () => {
    expect(clampWidth(50)).toBe(100);
  });

  it('should clamp width to maximum', () => {
    expect(clampWidth(1500)).toBe(1200);
  });

  it('should return width within range', () => {
    expect(clampWidth(500)).toBe(500);
  });

  it('should handle custom min/max', () => {
    expect(clampWidth(50, 200, 800)).toBe(200);
    expect(clampWidth(900, 200, 800)).toBe(800);
    expect(clampWidth(500, 200, 800)).toBe(500);
  });
});
