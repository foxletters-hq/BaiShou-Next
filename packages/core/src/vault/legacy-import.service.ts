import fs from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import extract from 'extract-zip';
import os from 'node:os';
import { DevicePreferences, SummaryType } from '@baishou/shared';
// 注意这里我们只建立降级写入需要的 Repository，真正的复杂 ORM 会由外部注入

export interface ILegacyDatabaseAdapter {
  clearAllAgentData(): Promise<void>;
  insertLegacySummaries(summariesData: any[]): Promise<number>;
  insertLegacyAgentData(data: {
    aiAssistants?: any[];
    agentSessions?: any[];
    agentMessages?: any[];
    agentParts?: any[];
    agentEmbeddings?: any[];
  }): Promise<void>;
}

export interface ILegacyFileAdapter {
  writeLegacyDiary(superDiary: any): Promise<void>;
  copyLegacyAttachments(sourceDir: string): Promise<void>;
}

export class LegacyArchiveImportService {
  constructor(
    private readonly dbAdapter: ILegacyDatabaseAdapter,
    private readonly fileAdapter: ILegacyFileAdapter
  ) {}

  /**
   * 处理旧版 V1/V2 采用纯 JSON Schema 落盘的文件格式解析，并将之转化为最新的 Db
   */
  async importLegacyZip(zipFilePath: string): Promise<{ deviceConfig?: DevicePreferences, filesCount: number }> {
    const stagingDir = path.join(os.tmpdir(), `baishou_legacy_restore_${Date.now()}`);
    await fs.mkdir(stagingDir, { recursive: true });

    let deviceConfig: DevicePreferences | undefined;
    
    try {
      await extract(zipFilePath, { dir: stagingDir });
      
      const manifestPath = path.join(stagingDir, 'manifest.json');
      if (!existsSync(manifestPath)) {
        throw new Error('Not a valid legacy Baishou backup. Built-in manifest.json is missing.');
      }
      
      const manifestStr = await fs.readFile(manifestPath, 'utf8');
      const schemaVersion = JSON.parse(manifestStr).schema_version || 0;

      // 解析所有的 JSON
      const parseJSON = async (relativePath: string) => {
        const full = path.join(stagingDir, relativePath);
        if (!existsSync(full)) return null;
        try { return JSON.parse(await fs.readFile(full, 'utf8')); } catch { return null; }
      };

      const diariesJson = await parseJSON('data/diaries.json') as any[] | null;
      const summariesJson = await parseJSON('data/summaries.json') as any[] | null;
      const configJson = await parseJSON('config/user_profile.json') as DevicePreferences | null;
      
      const aiAssistants = await parseJSON('data/ai_assistants.json') as any[] | null;
      const agentSessions = await parseJSON('data/agent_sessions.json') as any[] | null;
      const agentMessages = await parseJSON('data/agent_messages.json') as any[] | null;
      const agentParts = await parseJSON('data/agent_parts.json') as any[] | null;
      const agentEmbeddings = await parseJSON('data/agent_embeddings.json') as any[] | null;

      // 1. 清空现有的所有 agent 数据防止重叠冲突
      await this.dbAdapter.clearAllAgentData();

      // 2. 转换落后版本的 Diaries
      let importedDiaries = 0;
      if (diariesJson && diariesJson.length > 0) {
        importedDiaries = await this._importLegacyDiaries(diariesJson, schemaVersion);
      }

      // 3. 转换遗留的 Summary 到新的 Summaries 表结构
      let importedSummaries = 0;
      if (summariesJson && summariesJson.length > 0) {
        importedSummaries = await this.dbAdapter.insertLegacySummaries(summariesJson);
      }

      // 4. 重建 Agent 附属聊天数据历史，由于它在 v3 只负责 RAG 对话检索
      await this.dbAdapter.insertLegacyAgentData({
        aiAssistants: aiAssistants || [],
        agentSessions: agentSessions || [],
        agentMessages: agentMessages || [],
        agentParts: agentParts || [],
        agentEmbeddings: agentEmbeddings || []
      });

      // 5. 将旧版的附件原封不动塞过去
      const attachDir = path.join(stagingDir, 'attachments');
      if (existsSync(attachDir)) {
         await this.fileAdapter.copyLegacyAttachments(attachDir);
      }

      deviceConfig = configJson || undefined;
      return { deviceConfig, filesCount: importedDiaries + importedSummaries };

    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => null);
    }
  }

  private async _importLegacyDiaries(diariesJson: any[], schemaVersion: number): Promise<number> {
    const grouped = new Map<string, any[]>();
    for (const diary of diariesJson) {
      const dateObj = diary.date ? new Date(diary.date) : new Date();
      // yyyy-MM-dd
      const dayKey = dateObj.toISOString().split('T')[0];
      if (!grouped.has(dayKey)) grouped.set(dayKey, []);
      grouped.get(dayKey)!.push(diary);
    }

    for (const [dayKey, list] of grouped.entries()) {
      list.sort((a, b) => (a.created_at ? new Date(a.created_at).getTime() : Date.now()) - (b.created_at ? new Date(b.created_at).getTime() : Date.now()));

      let buffer = '';
      const mergedTags = new Set<string>();
      const mergedMediaPaths = new Set<string>();

      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (schemaVersion < 1) {
          const dt = d.created_at ? new Date(d.created_at) : new Date();
          const t = dt.toISOString().split('T')[1].substring(0, 8);
          buffer += `##### ${t}\n\n`;
        }
        buffer += (d.content || '').trim() + '\n';
        if (i < list.length - 1 && schemaVersion < 1) {
           buffer += '\n---\n\n';
        }
        for (const t of (d.tags || [])) mergedTags.add(t);
        for (const m of (d.media_paths || [])) mergedMediaPaths.add(m);
      }

      if (list.length === 0) continue;

      const superDiary = {
        ...list[list.length - 1], // 以最后一条记录的时间参数为准
        content: buffer.trim(),
        tags: Array.from(mergedTags),
        mediaPaths: Array.from(mergedMediaPaths)
      };

      await this.fileAdapter.writeLegacyDiary(superDiary);
    }

    return diariesJson.length;
  }
}
