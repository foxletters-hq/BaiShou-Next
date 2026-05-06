import { parseDateStr } from '@baishou/shared';
import { ParsedJournal } from './shadow-index-sync.types';

/**
 * 安全地将字符串解析为 Date 对象
 * 解析失败时返回 fallback，避免 Invalid Date 导致 toISOString() 崩溃
 */
function safeParseDateTime(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

/**
 * 解析 Markdown 文件内容（含 Frontmatter）
 * 
 * 支持标准的 `---` 分隔的 YAML Frontmatter 格式：
 * ```
 * ---
 * id: 42
 * date: 2026-03-31
 * tags: [日记, 生活]
 * weather: 晴
 * mood: 开心
 * ---
 * 日记正文内容...
 * ```
 */
export function parseJournalMarkdown(raw: string, fallbackDate: Date): ParsedJournal | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = raw.match(frontmatterRegex);

  const content = match ? (match[2] || '').trim() : raw.trim();
  // Allow empty text diaries, do not return null here.

  const meta: Record<string, string> = {};
  if (match && match[1]) {
    for (const line of match[1].split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      if (key) meta[key] = val;
    }
  }

  // 解析标签
  let tags: string[] = [];
  if (meta['tags']) {
    const tagStr = meta['tags'].replace(/^\[/, '').replace(/\]$/, '');
    tags = tagStr.split(',').map(s => s.trim()).filter(Boolean);
  }

  // 解析日期：使用本地时区（禁止 new Date('YYYY-MM-DD') 会被解析为 UTC）
  const dateStr = meta['date'];
  const parsedDate = dateStr ? parseDateStr(dateStr) : fallbackDate;

  // 解析媒体路径
  let mediaPaths: string[] = [];
  if (meta['mediaPaths'] || meta['media_paths']) {
    try {
      mediaPaths = JSON.parse(meta['mediaPaths'] || meta['media_paths'] || '[]');
    } catch { /* ignore */ }
  }

  const now = new Date();
  return {
    id: meta['id'] ? Number(meta['id']) : 0,
    date: parsedDate,
    content,
    tags,
    createdAt: safeParseDateTime(meta['created_at'] || meta['createdAt'], meta['date'] ? parsedDate : now),
    updatedAt: safeParseDateTime(meta['updated_at'] || meta['updatedAt'], now),
    weather: meta['weather'] || undefined,
    mood: meta['mood'] || undefined,
    location: meta['location'] || undefined,
    locationDetail: meta['location_detail'] || meta['locationDetail'] || undefined,
    isFavorite: meta['is_favorite'] === 'true' || meta['isFavorite'] === 'true',
    mediaPaths,
  };
}
