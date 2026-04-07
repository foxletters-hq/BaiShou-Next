import fs from 'node:fs/promises';
import path from 'node:path';
import { formatLocalDate } from '@baishou/shared';
import { IStoragePathService } from './storage-path.types';

/**
 * 日记文件读写服务（vault 层简化版）
 *
 * 时区约定：使用本地时区计算路径与文件名，与 FileSyncServiceImpl 保持一致。
 */
export class JournalFileService {
  constructor(private readonly pathProvider: IStoragePathService) {}

  /** 根据本地时区日期构建文件路径：journalBase/YYYY/MM/YYYY-MM-DD.md */
  private buildFilePath(journalBase: string, date: Date): string {
    const dateStr = formatLocalDate(date);
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(5, 7);
    return path.join(journalBase, year, month, `${dateStr}.md`);
  }

  /**
   * 将日记内容写入对应的物理 Markdown 文件
   * @param date 日记的日期，决定物理路径（例如 2026/03/2026-03-10.md）
   * @param content 日记内容
   */
  async writeJournal(date: Date, content: string): Promise<string> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    const fullPath = this.buildFilePath(journalBase, date);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content.trim(), 'utf8');
    return fullPath;
  }

  async readJournal(date: Date): Promise<string | null> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    const fullPath = this.buildFilePath(journalBase, date);
    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async deleteJournal(date: Date): Promise<void> {
    const journalBase = await this.pathProvider.getJournalsBaseDirectory();
    const fullPath = this.buildFilePath(journalBase, date);
    try {
      await fs.unlink(fullPath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}
