import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { MemoryRepository } from '../memory.repository';
// require('sqlite-vec');
import * as sqliteVec from "sqlite-vec";

let sqliteDb: Database.Database;
let db: ReturnType<typeof drizzle>;
let repo: MemoryRepository;

describe('MemoryRepository RAG Vector Operations', () => {
  beforeAll(async () => {
    sqliteDb = new Database(':memory:');
    
    // 自动加载 sqlite-vec 扩展以启用 vec_distance_cosine 函数!
    // 如果你在 CI 跑该测试，需要确保能够加载 C 二进制。对于 node 绑定由 load 搞定：
    sqliteVec.load(sqliteDb);

    db = drizzle(sqliteDb);

    // 运行 DDL (为由于测试环境不调 db:push 我们手写 mock DDL)
    sqliteDb.exec(`
      CREATE TABLE memory_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL DEFAULT 0,
        chunk_text TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        embedding BLOB NOT NULL,
        dimension INTEGER NOT NULL,
        model_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        source_created_at INTEGER
      );
    `);

    repo = new MemoryRepository(db);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  it('should store and retrieve vectors reliably across multiple dimensions by modelId prep-filtering', async () => {
    // 注入 768 维度的 BGE-M3 的虚假特征数据
    await repo.storeMemory({
      embeddingId: 'bge-1', sourceType: 'diary', sourceId: 'entry-1', groupId: 'user-1',
      chunkIndex: 0, chunkText: '今天去看了樱花', metadataJson: '{}',
      modelId: 'bge-m3',
      embedding: [0.1, 0.2, 0.3] // 此处作为代替真实768维进行运算
    });

    // 注入 1536 维度的 text-embedding-3-small 的虚假特征数据
    await repo.storeMemory({
      embeddingId: 'openai-1', sourceType: 'diary', sourceId: 'entry-2', groupId: 'user-1',
      chunkIndex: 0, chunkText: '明天要去看樱花', metadataJson: '{}',
      modelId: 'text-embedding-3-small',
      embedding: [0.5, 0.5, 0.5, 0.5] // 代替真实 1536维，多一个维度
    });

    await repo.storeMemory({
      embeddingId: 'openai-2', sourceType: 'diary', sourceId: 'entry-3', groupId: 'user-1',
      chunkIndex: 0, chunkText: '修车真麻烦', metadataJson: '{}',
      modelId: 'text-embedding-3-small',
      embedding: [-0.5, -0.5, 0.1, 0.1]
    });

    // 开始查询。如果我们在预过滤逻辑 `WHERE modelId...` 里没有挡住，用[0.5, 0.5, 0.5, 0.5] 去做 vec_distance_cosine
    // 计算[0.1, 0.2, 0.3] 时，sqlite-vec 会因为数组维度不同立刻抛出异常（Mismatched Array Size）。 
    const results = await repo.searchByVector({
      queryVector: [0.4, 0.5, 0.5, 0.5],
      modelId: 'text-embedding-3-small',
      limit: 2
    });

    // 断言由于正确拦截，不报错且能搜出预期的两条结果
    expect(results.length).toBe(2);
    // 第一条应当是 openai-1 (内容更相关，夹角小)
    expect(results[0].embeddingId).toBe('openai-1');
  });
});
