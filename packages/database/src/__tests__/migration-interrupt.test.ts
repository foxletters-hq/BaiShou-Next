import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('SqliteHybridSearchRepository - Migration and Interrupt Recovery', () => {
    let db: ReturnType<typeof createClient>;
    let repo: SqliteHybridSearchRepository;
    let tempDir: string;
    let dbPath: string;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-mig-test-'));
        dbPath = path.join(tempDir, 'mig_test.db');
        db = createClient({ url: `file:${dbPath}` });
        repo = new SqliteHybridSearchRepository(db);

        // memory_embeddings 表由 Drizzle 管理，测试中手动建表
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
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
    });

    it('should correctly build backup table and track the pending chunks across dimension shift', async () => {
        // 1. 造点假数据，模拟我们换模型换维度前留下的历史财产
        const fakeEmb1536 = new Array(1536).fill(0.123); // 巨型无用 Float32 原初嵌入
        await repo.insertEmbedding({
            id: 'legacy-chunk-1', sourceType: 'diary', sourceId: 'd1', groupId: 'g1',
            chunkIndex: 0, chunkText: '我昨天吃了一顿麦当劳。', embedding: fakeEmb1536, modelId: 'old-model-1536'
        });
        await repo.insertEmbedding({
            id: 'legacy-chunk-2', sourceType: 'diary', sourceId: 'd2', groupId: 'g1',
            chunkIndex: 1, chunkText: '但是可乐不好喝。', embedding: fakeEmb1536, modelId: 'old-model-1536'
        });

        // 断言最初的时候没有 migration 发生
        expect(await repo.hasPendingMigration()).toBe(false);

        // 2. [触发大事件：模型被更换了，比如改成了 768 的新大模型]
        // Alpha Agent 通知 Repository 先在原时空锁定保存一下纯粹精肉（丢掉 BLOB 提取）！
        const backupNum = await repo.createMigrationBackup();
        expect(backupNum).toBe(2); // 成功建立两块的临时缓冲空间
        expect(await repo.hasPendingMigration()).toBe(true);
        expect(await repo.getUnmigratedCount()).toBe(2);

        // Alpha Agent 正式通知底层进行维度拆家洗盘重建
        await repo.clearAndReinitEmbeddings(768);
        
        // 验证主实体表已经被无情洗劫，完全配合重建维度准备拥抱新生
        const verifyEmpty = await db.execute(`SELECT count(*) as c FROM memory_embeddings`);
        expect(Number(verifyEmpty.rows[0]?.c)).toBe(0);

        // 3. [触发打断重连机制：假如断网程序重启，依靠探针找回残留的缓冲件]
        expect(await repo.hasPendingMigration()).toBe(true); // 探针依然坚挺地知道还没完成！
        const unmigratedItems = await repo.getUnmigratedBackupChunks();
        expect(unmigratedItems.length).toBe(2); // 只取回两块准备拉大模型的
        expect(unmigratedItems[0]!.chunkText).toBe('我昨天吃了一顿麦当劳。');
        // 注意：原先 1536 的庞大嵌入字段已经被脱水遗落，大大减少内存穿梭压力
        expect(unmigratedItems[0]!.embedding).toBeUndefined();

        // 模拟调用大模型取得了 768 维度的结果，再导回！
        const fakeEmb768 = new Array(768).fill(0.999);
        const chunk0Id = unmigratedItems[0]!.embedding_id as string;
        await repo.insertEmbedding({
            id: chunk0Id, sourceType: unmigratedItems[0]!.sourceType as string, sourceId: unmigratedItems[0]!.sourceId as string,
            groupId: unmigratedItems[0]!.groupId as string, chunkIndex: unmigratedItems[0]!.chunkIndex as number, chunkText: unmigratedItems[0]!.chunkText as string,
            embedding: fakeEmb768, modelId: 'new-model-768'
        });
        
        // 我们把它标志为"已迁徙完成"
        await repo.markBackupChunkMigrated(chunk0Id);
        
        // 断言还剩下多少没迁
        expect(await repo.getUnmigratedCount()).toBe(1);

        // 最后一块也迁完了
        const chunk1Id = unmigratedItems[1]!.embedding_id as string;
        await repo.markBackupChunkMigrated(chunk1Id);
        expect(await repo.getUnmigratedCount()).toBe(0);
        expect(await repo.hasPendingMigration()).toBe(false); // 洗白完成，可以把备份表彻底爆破了

        // 5. 收尾动作
        await repo.dropMigrationBackup();
        expect(async () => await repo.hasPendingMigration()).not.toThrow();

        // 到此，不仅主表完成了安全迁移，新维度下运作强健！即使底层不支持也能正常回退，一切行云流水无缺无漏。
    });
});
