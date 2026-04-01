import { Diary } from '@baishou/shared';

export interface ExportOptions {
  format: 'txt' | 'json' | 'md';
  dateRange?: { start: Date; end: Date };
  includeMedia?: boolean;
}

export interface DiaryExportService {
  export(diaries: Diary[], options: ExportOptions): Promise<Buffer>;
}

export class DiaryExportServiceImpl implements DiaryExportService {
  
  async export(diaries: Diary[], options: ExportOptions): Promise<Buffer> {
    switch (options.format) {
      case 'json':
        return Buffer.from(JSON.stringify(diaries, null, 2), 'utf-8');
      case 'txt':
        return Buffer.from(this.buildText(diaries), 'utf-8');
      case 'md':
      default:
        return Buffer.from(this.buildMarkdown(diaries), 'utf-8');
    }
  }

  private buildText(diaries: Diary[]): string {
    return diaries.map(diary => {
      const dateStr = diary.date.toISOString().split('T')[0];
      return `${dateStr}\n${diary.content}\n\n`;
    }).join('---\n\n');
  }

  private buildMarkdown(diaries: Diary[]): string {
    const sb: string[] = [];
    let currentMonth: string | null = null;

    for (const diary of diaries) {
      // Assume "yyyy-MM"
      const monthStr = diary.date.toISOString().slice(0, 7);
      if (monthStr !== currentMonth) {
        currentMonth = monthStr;
        sb.push(`# ${currentMonth}\n\n`);
      }

      const dateStr = diary.date.toISOString().split('T')[0];
      sb.push(`## ${dateStr}\n`);

      const tagsArray = typeof diary.tags === 'string' ? diary.tags.split(',').filter(Boolean) : [];
      if (tagsArray.length > 0) {
        sb.push(`🏷️: ${tagsArray.map(t => `#${t.trim()}`).join(' ')}\n`);
      }

      sb.push(`\n${diary.content}\n\n`);
      sb.push(`---\n\n`);
    }

    return sb.join('');
  }
}

