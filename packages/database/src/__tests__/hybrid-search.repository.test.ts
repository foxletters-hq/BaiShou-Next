import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

    await repo.initVectorTables(3); // init with dimension 3
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
    it('creates agent_embeddings table', async () => {
      const res = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_embeddings'`);
      expect(res.rows.length).toBe(1);
    });

    it('can dynamically probe for native native vector search support via vector_top_k', async () => {
      // We probe whether vector extensions exist.
      // Depending on the environment, it may or may not exist (pure JS or fully loaded native)
      const isNative = repo.supportsNativeVectorSearch();
      expect(typeof isNative).toBe('boolean');
    });
  });

  describe('Fallback: JS Cosine Similarity Calculation', () => {
    it('should correctly fallback to JS pure cosine similarity calculation when native vector search is disabled or mocked out', async () => {
        // Manually insert vectors via insertEmbedding, bypassing F32_BLOB raw manipulation to keep it abstract 
        // We will insert embeddings
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

        // Note: queryNativeVector automatically handles the fallback
        const target = [1, 0, 0];
        const results = await repo.queryNativeVector(target, 2);
        
        expect(results.length).toBe(2);
        expect(results[0].messageId).toBe('f1');
        // JS cosine similarity fallback check
        expect(results[0].score).toBeGreaterThan(0.85); // should be quite similar to target
        expect(results[1].messageId).toBe('f2');
        expect(results[1].score).toBe(0); // target [1,0,0] and nonMatch [0,1,0] are orthogonal

        // Restore
        repo.supportsNativeVectorSearch = originalSupport;
    });
    
    it('should properly process missing or corrupted embeddings gracefully during JS fallback', async () => {
      // mock a bad row manually (it shouldn't throw error or crash the fallback loop)
      await db.execute(`INSERT INTO agent_embeddings (id, source_type, source_id, group_id, chunk_index, chunk_text, embedding, model_id) VALUES ('bad1', 'c', 's', 'fallback_group', 0, 'corrupt', vector('[error'), 'm')`).catch(() => {});
      
      const originalSupport = repo.supportsNativeVectorSearch;
      repo.supportsNativeVectorSearch = () => false;

      // Ensure it doesn't throw and resolves normally 
      await expect(repo.queryNativeVector([1, 0, 0], 2)).resolves.toBeInstanceOf(Array);
      repo.supportsNativeVectorSearch = originalSupport;
    });
  });

  describe('Decoupled Search Support', () => {
    it('fetchAllEmbeddingsForDecoupledSearch pulls out valid structured JSON data', async () => {
       await repo.insertEmbedding({
           id: 'mem1', sourceType: 'test', sourceId: 'src_test', groupId: 'sessionA', chunkIndex: 1,
           chunkText: 'Memory context hello', embedding: [0.1, 0.2, 0.3], modelId: 'modern-model'
       });

       const res = await repo.fetchAllEmbeddingsForDecoupledSearch('sessionA');
       expect(res).toHaveLength(1);
       expect(res[0].messageId).toBe('mem1');
       expect(res[0].chunkText).toBe('Memory context hello');
       expect(res[0].embedding).toEqual([0.1, 0.2, 0.3]);
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
       expect(res[0].messageId).toBe('fts1');
    });
  });
});
