import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient, Client } from '@libsql/client';
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('SqliteHybridSearchRepository (LibSQL)', () => {
  let db: Client;
  let repo: SqliteHybridSearchRepository;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vec-test-'));
    dbPath = path.join(tempDir, 'vec_test.db');
    
    db = createClient({ url: `file:${dbPath}` });
    repo = new SqliteHybridSearchRepository(db);

    // 手动建表 — 对齐 Drizzle ORM 的 memory_embeddings 表结构
    await db.execute(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id    TEXT NOT NULL UNIQUE,
        source_type     TEXT NOT NULL,
        source_id       TEXT NOT NULL,
        group_id        TEXT NOT NULL,
        chunk_index     INTEGER NOT NULL,
        chunk_text      TEXT NOT NULL,
        metadata_json   TEXT NOT NULL DEFAULT '{}',
        embedding       BLOB NOT NULL,
        dimension       INTEGER NOT NULL,
        model_id        TEXT NOT NULL,
        created_at      INTEGER NOT NULL,
        source_created_at INTEGER
      )
    `);
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  describe('Initialization Pipeline', () => {
    it('uses memory_embeddings table', async () => {
      const res = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`);
      expect(res.rows.length).toBe(1);
    });

    it('can dynamically probe for native vector search support', async () => {
      const isNative = repo.supportsNativeVectorSearch();
      expect(typeof isNative).toBe('boolean');
    });
  });

  describe('Fallback: JS Cosine Similarity Calculation', () => {
    it('should correctly fallback to JS pure cosine similarity calculation when native vector search is disabled or mocked out', async () => {
        await repo.insertEmbedding({
           id: 'f1', sourceType: 'c', sourceId: 's', groupId: 'fallback_group', chunkIndex: 0,
           chunkText: 'Match node', embedding: [0.9, 0.1, 0], modelId: 'm'
        });
        
        await repo.insertEmbedding({
           id: 'f2', sourceType: 'c', sourceId: 's', groupId: 'fallback_group', chunkIndex: 0,
           chunkText: 'Non match node', embedding: [0, 1, 0], modelId: 'm'
        });

        // Force native support to fail dynamically to trigger JS fallback
        const originalSupport = repo.supportsNativeVectorSearch;
        repo.supportsNativeVectorSearch = () => false;

        const target = [1, 0, 0];
        const results = await repo.queryNativeVector(target, 2);
        
        expect(results.length).toBe(2);
        expect(results[0]!.messageId).toBe('f1');
        expect(results[0]!.score).toBeGreaterThan(0.85);
        expect(results[1]!.messageId).toBe('f2');
        expect(results[1]!.score).toBe(0);

        // Restore
        repo.supportsNativeVectorSearch = originalSupport;
    });
    
    it('should properly process missing or corrupted embeddings gracefully during JS fallback', async () => {
      // 插入一条原始 BLOB 无法被 hex(embedding) 解析的行（corrupted float 数据）
      await db.execute(`INSERT INTO memory_embeddings (embedding_id, source_type, source_id, group_id, chunk_index, chunk_text, embedding, dimension, model_id, created_at) VALUES ('bad1', 'c', 's', 'fallback_group', 0, 'corrupt', X'FF', 3, 'm', 0)`).catch(() => {});
      
      const originalSupport = repo.supportsNativeVectorSearch;
      repo.supportsNativeVectorSearch = () => false;

      // Ensure it doesn't throw and resolves normally 
      await expect(repo.queryNativeVector([1, 0, 0], 2)).resolves.toBeInstanceOf(Array);
      repo.supportsNativeVectorSearch = originalSupport;
    });
  });

  describe('Decoupled Search Support', () => {
    it('fetchAllEmbeddingsForDecoupledSearch pulls out valid structured data', async () => {
       await repo.insertEmbedding({
           id: 'mem1', sourceType: 'test', sourceId: 'src_test', groupId: 'sessionA', chunkIndex: 1,
           chunkText: 'Memory context hello', embedding: [0.1, 0.2, 0.3], modelId: 'modern-model'
       });

       const res = await repo.fetchAllEmbeddingsForDecoupledSearch('sessionA');
       expect(res).toHaveLength(1);
       expect(res[0]!.messageId).toBe('mem1');
       expect(res[0]!.chunkText).toBe('Memory context hello');
       // Float32 精度损失，使用 toBeCloseTo 比较
       expect(res[0]!.embedding[0]).toBeCloseTo(0.1, 2);
       expect(res[0]!.embedding[1]).toBeCloseTo(0.2, 2);
       expect(res[0]!.embedding[2]).toBeCloseTo(0.3, 2);
    });
  });

  describe('FTS Query', () => {
    it('queryFTS works flawlessly using general LIKE matching over chunks', async () => {
       await repo.insertEmbedding({
           id: 'fts1', sourceType: 'test', sourceId: 'src', groupId: 'sess', chunkIndex: 0,
           chunkText: 'The quick brown fox jumps over the lazy dog', embedding: [1,0,0], modelId: 'x'
       });
       await repo.insertEmbedding({
           id: 'fts2', sourceType: 'test', sourceId: 'src', groupId: 'sess', chunkIndex: 1,
           chunkText: 'A completely unrelated sentence', embedding: [0,1,0], modelId: 'x'
       });

       const res = await repo.queryFTS('fox', 5);
       expect(res).toHaveLength(1);
       expect(res[0]!.messageId).toBe('fts1');
    });
  });
});
