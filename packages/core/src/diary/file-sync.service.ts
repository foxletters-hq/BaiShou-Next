import * as fs from 'fs';
import * as path from 'path';
import { CreateDiaryInput, Diary } from '@baishou/shared';
import { IStoragePathService } from '../vault/storage-path.types';
/**
 * 负责日记内容的 Markdown 文件系统落盘与读取。
 */

export interface FileSyncService {
  writeJournal(diary: CreateDiaryInput | Diary): Promise<void>;
  readJournal(date: Date): Promise<Diary | null>;
  deleteJournalFile(date: Date): Promise<void>;
  fullScanVault(): Promise<void>;
}

export class FileSyncServiceImpl implements FileSyncService {
  constructor(
    private readonly pathService: IStoragePathService, 
    // private readonly dbRepo: DiaryRepository // Inject this to sync data back inside fullScanVault if needed
  ) {}

  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  private formatDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  async writeJournal(diary: CreateDiaryInput | Diary): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory();
    const yearDir = path.join(rootPath, diary.date.getFullYear().toString());
    const monthDir = path.join(yearDir, this.pad(diary.date.getMonth() + 1));
    await this.ensureDir(monthDir);

    const fileName = `${this.formatDateString(diary.date)}.md`;
    const filePath = path.join(monthDir, fileName);

    const sb: string[] = [];
    sb.push('---');
    if ('id' in diary && diary.id) sb.push(`id: ${diary.id}`);
    sb.push(`date: ${this.formatDateString(diary.date)}`);
    if (diary.tags) {
      if (typeof diary.tags === 'string') {
        const arr = diary.tags.split(',').map(t => t.trim()).filter(Boolean);
        sb.push(`tags: [${arr.join(', ')}]`);
      } else if (Array.isArray(diary.tags)) {
        sb.push(`tags: [${diary.tags.join(', ')}]`);
      }
    }
    if ('updatedAt' in diary && diary.updatedAt) {
      sb.push(`updated_at: ${diary.updatedAt.toISOString()}`);
    }
    sb.push('---');
    sb.push('');
    sb.push(diary.content);

    await fs.promises.writeFile(filePath, sb.join('\n'), 'utf8');
  }

  async readJournal(date: Date): Promise<Diary | null> {
    const rootPath = await this.pathService.getJournalsBaseDirectory();
    const yearDir = path.join(rootPath, date.getFullYear().toString());
    const monthDir = path.join(yearDir, this.pad(date.getMonth() + 1));
    const fileName = `${this.formatDateString(date)}.md`;
    const filePath = path.join(monthDir, fileName);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = await fs.promises.readFile(filePath, 'utf8');
    // Implement naive frontmatter extraction to support standard formatting
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // Treat everything as content if no valid frontmatter
      return { date, content } as Diary; 
    }

    const rawMeta = match[1] || '';
    const mdBody = match[2] || '';

    const diary: any = { date, content: mdBody.trim() };

    for (const line of rawMeta.split('\n')) {
      const [key, ...values] = line.split(':');
      if (!key) continue;
      
      const valStr = values.join(':').trim();
      if (key.trim() === 'id') diary.id = Number(valStr);
      if (key.trim() === 'tags') {
         const cleanStr = valStr.replace(/^\[/, '').replace(/\]$/, '');
         diary.tags = cleanStr.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (key.trim() === 'updated_at') diary.updatedAt = new Date(valStr);
    }

    return diary as Diary;
  }

  async deleteJournalFile(date: Date): Promise<void> {
    const rootPath = await this.pathService.getJournalsBaseDirectory();
    const yearDir = path.join(rootPath, date.getFullYear().toString());
    const monthDir = path.join(yearDir, this.pad(date.getMonth() + 1));
    const fileName = `${this.formatDateString(date)}.md`;
    const filePath = path.join(monthDir, fileName);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async fullScanVault(): Promise<void> {
    // Left empty for brevity; scans all YYYY/MM/*.md to build/re-sync missing indices.
  }
}
