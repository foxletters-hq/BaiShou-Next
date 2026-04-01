import fs from 'node:fs/promises';
import path from 'node:path';
import { IStoragePathService } from './storage-path.types';

export class JournalFileService {
  constructor(private readonly pathProvider: IStoragePathService) {}

  /**
   * 将日记内容格式化输出到物理 Markdown 之中
   * @param date 日记的日期，决定物理路径 (例如 2026/03/2026-03-10.md)
   * @param content 日记内容
   */
  async writeJournal(date: Date, content: string): Promise<string> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    
    // yyyy / MM / yyyy-MM-dd.md 规约
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');

    const targetDir = path.join(journalBase, year, month);
    await fs.mkdir(targetDir, { recursive: true });

    const fileName = `${year}-${month}-${day}.md`;
    const fullPath = path.join(targetDir, fileName);

    await fs.writeFile(fullPath, content.trim(), 'utf8');
    return fullPath;
  }

  async readJournal(date: Date): Promise<string | null> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');

    const fileName = `${year}-${month}-${day}.md`;
    const fullPath = path.join(journalBase, year, month, fileName);

    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async deleteJournal(date: Date): Promise<void> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    
    const year = date.getUTCFullYear().toString();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');

    const fileName = `${year}-${month}-${day}.md`;
    const fullPath = path.join(journalBase, year, month, fileName);

    try {
      await fs.unlink(fullPath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}
