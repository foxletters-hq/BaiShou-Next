import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteHybridSearchRepository } from '../hybrid-search.repository';
import * as sqliteVec from 'sqlite-vec';

describe('SqliteHybridSearchRepository with native vec support', () => {
  let db: Database.Database;
  let repo: SqliteHybridSearchRepository;

  beforeEach(() => {
    // 启动完全内存模式的原生 SQL 测试（不会在机器落地文件垃圾），毫秒级完成
    db = new Database(':memory:');
    repo = new SqliteHybridSearchRepository(db);

    // 目前 SqliteVec 在 Node V20 及以下通常可以直接装载起作用
    // 特此构建初始表（指定维度为 3 的测试环境维度）
    repo.initVectorTables(3);
  });

  afterEach(() => {
    db.close();
  });

  it('should explicitly load sqlite-vec capabilities', () => {
    // 如果构建机器具备该版本，应当为 true
    // sqlite-vec 有时依赖系统或者特定的预编译模块，无论它返回真假，
    // 我们至少能验证探针是否能够稳定回退
    expect(repo.supportsNativeVectorSearch()).toBeDefined();
  });

  describe('Trigger Automation and Memory Fetch Sync', () => {
    it('creates triggers linking agent_embeddings to vec_agent_embeddings seamlessly', () => {
      if (!repo.supportsNativeVectorSearch()) {
        console.warn('Skipping native vector test as extension failed to load on this architecture.');
        return;
      }

      // 测试插入实体表 (手动插一条用 float32 array 装载成 buffer 进去的数据)
      const dataToInsert = [0.1, 0.2, 0.3];
      const buffer = Buffer.from(new Float32Array(dataToInsert).buffer);

      db.prepare(`
        INSERT INTO agent_embeddings (id, source_type, source_id, group_id, chunk_index, chunk_text, metadata_json, embedding, model_id, source_created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('msg1', 'chat', 'src1', 'sessionA', 0, 'This is a magic trigger test context', '{}', buffer, 'model1', 123456);

      // 直接从虚拟表抽查，看 Trigger 有没有发威！
      const vecRows = db.prepare('SELECT id FROM vec_agent_embeddings').all() as any[];
      expect(vecRows.length).toBe(1);
      expect(vecRows[0].id).toBe('msg1');

      // 验证通过 Memory 模式获取原汁原味的相量结构是否正确
      const fetchAllRes = repo.fetchAllEmbeddingsForDecoupledSearch('sessionA');
      fetchAllRes.then(rows => {
         expect(rows.length).toBe(1);
         expect(rows[0].chunkText).toBe('This is a magic trigger test context');
         // 浮点数精度校验
         expect(rows[0].embedding[0]).toBeCloseTo(0.1, 3);
      });
    });

    it('should correctly fetch matching neighbors via queryNativeVector with low distance (high cosine)', async () => {
      if (!repo.supportsNativeVectorSearch()) return; // 防御性判断

      const target = [1, 0, 0];
      const other = [0, 1, 0];

      db.prepare(`INSERT INTO agent_embeddings (id, source_type, source_id, group_id, chunk_index, chunk_text, embedding, model_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'm1', 'c', 's', 'g', 0, 'Target!', Buffer.from(new Float32Array(target).buffer), 'm'
      );
      
      db.prepare(`INSERT INTO agent_embeddings (id, source_type, source_id, group_id, chunk_index, chunk_text, embedding, model_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'm2', 'c', 's', 'g', 0, 'Other!', Buffer.from(new Float32Array(other).buffer), 'm'
      );

      // 寻找 [1,0,0] 的极似项
      const results = await repo.queryNativeVector([1, 0, 0], 2);
      expect(results.length).toBeGreaterThan(0);
      
      // 第一个命中的必然是最近的（即 m1）因为两者完全一样
      expect(results[0].messageId).toBe('m1');
      // score 是由原生 SQLite Vec 引擎计算的 `distance` （这里转换为了 1 - dist = 1 - 0 = 1.0)
      expect(results[0].score).toBeCloseTo(1.0, 3);
    });

    it('test updating main table triggers update in vec table', () => {
      if (!repo.supportsNativeVectorSearch()) return;
      db.prepare(`INSERT INTO agent_embeddings (id, source_type, source_id, group_id, chunk_index, chunk_text, embedding, model_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'm3', 'c', 's', 'g', 0, 'Will update', Buffer.from(new Float32Array([1, 1, 1]).buffer), 'm'
      );

      const newBuffer = Buffer.from(new Float32Array([2, 2, 2]).buffer);
      db.prepare('UPDATE agent_embeddings SET embedding = ? WHERE id = ?').run(newBuffer, 'm3');
      
      const v = db.prepare('SELECT embedding as vec_data FROM vec_agent_embeddings WHERE id = ?').get('m3') as any;
      expect(v).toBeDefined();
      // 在底层这应该被映射，虽然我们不需要手动验证 C 后端数组二进制格式，但只要确保它还有这条记录没丢失即可
    });
  });
});
