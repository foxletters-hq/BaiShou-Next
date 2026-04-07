import { ipcMain } from 'electron';
import { EmbeddingService } from '@baishou/ai/src/rag/embedding.service';
import { IEmbeddingConfig } from '@baishou/ai/src/rag/embedding.types';
import { settingsManager } from './settings.ipc';
import { DesktopEmbeddingStorage } from './rag.storage';
import { getDiaryManager } from './diary.ipc';
import { getAppDb } from '../db';
import { memoryEmbeddingsTable } from '@baishou/database';
import { eq, sql, desc, like } from 'drizzle-orm';
import { AIProviderConfig } from '@baishou/shared';




class DesktopEmbeddingConfig implements IEmbeddingConfig {
  private _cachedConfig: any = {};

  async load() {
    this._cachedConfig = await settingsManager.get<any>('global_models') || {};
  }

  getGlobalEmbeddingModelId(): string {
    return this._cachedConfig.globalEmbeddingModelId || '';
  }
  getGlobalEmbeddingProviderId(): string {
    return this._cachedConfig.globalEmbeddingProviderId || '';
  }
  getGlobalEmbeddingDimension(): number {
    return this._cachedConfig.globalEmbeddingDimension || 0;
  }
  async setGlobalEmbeddingDimension(dimension: number): Promise<void> {
    const config = await settingsManager.get<any>('global_models') || {};
    config.globalEmbeddingDimension = dimension;
    await settingsManager.set('global_models', config);
    this._cachedConfig = config;
  }
  async getProviderInstance(): Promise<any> {
    const providerId = this.getGlobalEmbeddingProviderId();
    if (!providerId) return null;

    const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
    const pConfig = providers.find(p => p.id === providerId);
    if (!pConfig) return null;

    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry');
    return AIProviderRegistry.getInstance().createProviderInstance(pConfig);
  }
}

export function registerRagIPC() {
  const config = new DesktopEmbeddingConfig();
  const storage = new DesktopEmbeddingStorage();
  const embeddingService = new EmbeddingService(config, storage);

  ipcMain.handle('rag:get-stats', async () => {
    await config.load();
    const db = getAppDb();
    const countRes = await db.select({ count: sql<number>`count(*)` }).from(memoryEmbeddingsTable);
    const count = countRes[0]?.count || 0;
    
    return {
      totalCount: count,
      currentDimension: config.getGlobalEmbeddingDimension(),
      totalSizeText: `${(count * 2.5).toFixed(1)} KB` // Mock size calc for UI
    };
  });

  ipcMain.handle('rag:detect-dimension', async () => {
    await config.load();
    return await embeddingService.detectDimension();
  });

  ipcMain.handle('rag:clear-dimension', async () => {
    await config.load();
    await storage.clearEmbeddings();
    await config.setGlobalEmbeddingDimension(0);
    return true;
  });

  ipcMain.handle('rag:clear-all', async () => {
    await config.load();
    await storage.clearEmbeddings();
    await config.setGlobalEmbeddingDimension(0);
    return true;
  });

  ipcMain.handle('rag:trigger-batch-embed', async (event) => {
    await config.load();
    try {
      // Only read diaries efficiently without full content if possible, but we need text to embed
      const diaries = await getDiaryManager().listAll({ limit: 10000 });
      let progress = 0;
      const total = diaries?.length || 0;
      
      for (const meta of diaries) {
        progress++;
        event.sender.send('agent:rag-progress', {
          isRunning: true, type: 'batchEmbed', progress, total, statusText: `处理日记: ${new Date(meta.date).toLocaleDateString()}`
        });

        const diary = await getDiaryManager().findById(meta.id);
        if (!diary || !diary.id || !diary.content || !diary.content.trim()) continue;

        // Perform embedding
        await embeddingService.reEmbedText({
          text: diary.content,
          sourceType: 'diary',
          sourceId: diary.id.toString(),
          groupId: 'diary',
          sourceCreatedAt: diary.date.getTime()
        });
      }
      
      event.sender.send('agent:rag-progress', { isRunning: false, progress: total, total, type: 'idle' });
      return true;
    } catch (e: any) {
      console.error('Batch Embed failed:', e);
      event.sender.send('agent:rag-progress', { isRunning: false, type: 'idle' });
      throw e;
    }
  });

  ipcMain.handle('rag:add-manual-memory', async (_, text: string) => {
    await config.load();
    if (!text || !text.trim()) return false;
    
    await embeddingService.embedText({
      text,
      sourceType: 'manual',
      sourceId: `manual_${Date.now()}`,
      groupId: 'manual',
      sourceCreatedAt: Date.now()
    });
    return true;
  });

  ipcMain.handle('rag:query-entries', async (_, params: { keyword: string, limit: number }) => {
    const db = getAppDb();
    const query = db.select().from(memoryEmbeddingsTable);
    
    if (params.keyword && params.keyword.trim() !== '') {
      query.where(like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`));
    }
    
    const results = await query.orderBy(desc(memoryEmbeddingsTable.createdAt)).limit(params.limit || 50);
    
    return results.map(r => ({
      embeddingId: r.embeddingId,
      text: r.chunkText,
      modelId: r.modelId,
      createdAt: r.createdAt?.getTime() || 0
    }));
  });

  ipcMain.handle('rag:delete-entry', async (_, embeddingId: string) => {
    const db = getAppDb();
    await db.delete(memoryEmbeddingsTable).where(eq(memoryEmbeddingsTable.embeddingId, embeddingId));
    return true;
  });

  ipcMain.handle('rag:edit-entry', async (_, params: { embeddingId: string, newText: string }) => {
    await config.load();
    if (!params.newText || !params.newText.trim()) return false;
    
    const db = getAppDb();
    const records = await db.select().from(memoryEmbeddingsTable).where(eq(memoryEmbeddingsTable.embeddingId, params.embeddingId));
    const record = records[0];
    if (!record) throw new Error("Memory not found");

    await embeddingService.updateMemoryChunk({
      entry: {
        embedding_id: record.embeddingId,
        source_type: record.sourceType,
        source_id: record.sourceId,
        group_id: record.groupId,
        chunk_index: record.chunkIndex,
        metadata_json: record.metadataJson
      },
      newText: params.newText
    });
    return true;
  });

  ipcMain.handle('rag:trigger-migration', async (event) => {
    await config.load();
    try {
      const generator = embeddingService.migrateEmbeddings();
      for await (const state of generator) {
        event.sender.send('agent:rag-progress', {
          isRunning: true,
          type: 'migration',
          progress: state.completed,
          total: state.total,
          statusText: state.status
        });
      }
      event.sender.send('agent:rag-progress', { isRunning: false, progress: 0, total: 0, type: 'idle' });
      return true;
    } catch (e: any) {
      console.error('Migration failed:', e);
      event.sender.send('agent:rag-progress', { isRunning: false, type: 'idle' });
      throw e;
    }
  });
}
