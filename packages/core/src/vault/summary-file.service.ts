import fs from 'node:fs/promises';
import path from 'node:path';
import { IStoragePathService } from './storage-path.types';
import { SummaryType, formatLocalDate } from '@baishou/shared';

export class SummaryFileService {
  constructor(private readonly pathProvider: IStoragePathService) {}

  private async getCategoryDir(type: SummaryType): Promise<string> {
    const base = await this.pathProvider.getSummariesBaseDirectory();
    const typeDirName = type.charAt(0).toUpperCase() + type.slice(1);
    const targetDir = path.join(base, typeDirName);
    await fs.mkdir(targetDir, { recursive: true });
    return targetDir;
  }

  /**
   * 按白守规范格式化 Summary 文件名。例如：
   * Weekly: 2026-W12.md
   * Monthly: 2026-03.md
   */
  private buildFileName(type: SummaryType, startDate: Date): string {
    // 使用本地时区提取年月日
    const year = startDate.getFullYear().toString();
    const month = (startDate.getMonth() + 1).toString().padStart(2, '0');

    switch (type) {
      case SummaryType.monthly:
        return `${year}-${month}.md`;
      case SummaryType.yearly:
        return `${year}.md`;
      case SummaryType.quarterly: {
        const quarter = Math.floor(startDate.getMonth() / 3) + 1;
        return `${year}-Q${quarter}.md`;
      }
      case SummaryType.weekly: {
        // ISO 周数算法：以周四所在周为锄点（纯数学计算，募时区int）
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const dayNum = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - dayNum);
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}.md`;
      }
      default:
        return `${formatLocalDate(startDate)}.md`;
    }
  }

  async writeSummary(type: SummaryType, startDate: Date, content: string): Promise<string> {
    const dir = await this.getCategoryDir(type);
    const fileName = this.buildFileName(type, startDate);
    const fullPath = path.join(dir, fileName);
    
    await fs.writeFile(fullPath, content.trim(), 'utf8');
    return fullPath;
  }

  async readSummary(type: SummaryType, startDate: Date): Promise<string | null> {
    const dir = await this.getCategoryDir(type);
    const fileName = this.buildFileName(type, startDate);
    const fullPath = path.join(dir, fileName);

    try {
      return await fs.readFile(fullPath, 'utf8');
    } catch (e: any) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async deleteSummary(type: SummaryType, startDate: Date): Promise<void> {
    const dir = await this.getCategoryDir(type);
    const fileName = this.buildFileName(type, startDate);
    const fullPath = path.join(dir, fileName);

    try {
      await fs.unlink(fullPath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async listAllSummaries(): Promise<{ type: SummaryType, startDate: Date, endDate: Date, fullPath: string }[]> {
    const results: { type: SummaryType, startDate: Date, endDate: Date, fullPath: string }[] = [];
    const base = await this.pathProvider.getSummariesBaseDirectory();
    
    for (const type of Object.values(SummaryType)) {
      const typeDirName = type.charAt(0).toUpperCase() + type.slice(1);
      const typeDir = path.join(base, typeDirName);
      let files: string[] = [];
      try {
        files = await fs.readdir(typeDir);
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
        continue;
      }
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const dates = this.parseFileNameToDateRange(type as SummaryType, file);
        if (dates) {
          results.push({
            type: type as SummaryType,
            startDate: dates.startDate,
            endDate: dates.endDate,
            fullPath: path.join(typeDir, file)
          });
        }
      }
    }
    return results;
  }

  parseFileNameToDateRange(type: SummaryType, fileName: string): { startDate: Date, endDate: Date } | null {
    const name = fileName.replace('.md', '');
    const parts = name.split('-');
    const year = parseInt(parts[0] ?? '', 10);
    if (isNaN(year)) return null;

    if (type === SummaryType.yearly) {
      // 全年：1.1 — 12.31
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59),
      };
    }
    if (type === SummaryType.monthly && parts.length === 2) {
      const month = parseInt(parts[1] ?? '', 10) - 1;
      return {
        startDate: new Date(year, month, 1),
        endDate: new Date(year, month + 1, 0, 23, 59, 59),
      };
    }
    if (type === SummaryType.quarterly && parts.length === 2 && (parts[1] || '').startsWith('Q')) {
      const q = parseInt((parts[1] ?? '').substring(1), 10);
      const startMonth = (q - 1) * 3;
      return {
        startDate: new Date(year, startMonth, 1),
        endDate: new Date(year, startMonth + 3, 0, 23, 59, 59),
      };
    }
    if (type === SummaryType.weekly && parts.length === 2 && (parts[1] || '').startsWith('W')) {
      const week = parseInt((parts[1] ?? '').substring(1), 10);
      // 以 ISO 周界定周一和周日（本地时区）
      const simpleDate = new Date(year, 0, 4 + (week - 1) * 7);
      const dayOfWeek = simpleDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const start = new Date(simpleDate.getFullYear(), simpleDate.getMonth(), simpleDate.getDate() - diff, 0, 0, 0);
      const end = new Date(start.getTime() + 6 * 86400000 + 23 * 3600000 + 59 * 60000 + 59000);
      return { startDate: start, endDate: end };
    }
    return null;
  }
}
