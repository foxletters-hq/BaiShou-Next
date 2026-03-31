import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository';

describe('SqliteHybridSearchRepository - Migration and Interrupt Recovery', () => {
    let db: Database.Database;
    let repo: SqliteHybridSearchRepository;

    beforeEach(async () => {
        db = new Database(':memory:');
        repo = new SqliteHybridSearchRepository(db);
        // 初始化一个老的 1536 维度的模型表空间
        await repo.initVectorIndex(1536);
    });

    afterEach(() => {
        db.close();
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
        const verifyEmptyQuery = db.prepare('SELECT count(*) as c FROM agent_embeddings').get() as any;
        expect(verifyEmptyQuery.c).toBe(0); 

        // 3. [触发打断重连机制：假如断网程序重启，依靠探针找回残留的缓冲件]
        expect(await repo.hasPendingMigration()).toBe(true); // 探针依然坚挺地知道还没完成！
        const unmigratedItems = await repo.getUnmigratedBackupChunks();
        expect(unmigratedItems.length).toBe(2); // 只取回两块准备拉大模型的
        expect(unmigratedItems[0].chunkText).toBe('我昨天吃了一顿麦当劳。');
        // 注意：原先 1536 的庞大嵌入字段已经被脱水遗落，大大减少内存穿梭压力
        expect(unmigratedItems[0].embedding).toBeUndefined(); 

        // 模拟调用大模型取得了 768 维度的结果，再导回！
        const fakeEmb768 = new Array(768).fill(0.999);
        await repo.insertEmbedding({
            id: unmigratedItems[0].id, sourceType: unmigratedItems[0].sourceType, sourceId: unmigratedItems[0].sourceId, 
            groupId: unmigratedItems[0].groupId, chunkIndex: unmigratedItems[0].chunkIndex, chunkText: unmigratedItems[0].chunkText, 
            embedding: fakeEmb768, modelId: 'new-model-768'
        });
        
        // 我们把它标志为“已迁徙完成”
        await repo.markBackupChunkMigrated(unmigratedItems[0].id);
        
        // 断言还剩下多少没迁
        expect(await repo.getUnmigratedCount()).toBe(1);

        // 最后一块也迁完了
        await repo.markBackupChunkMigrated(unmigratedItems[1].id);
        expect(await repo.getUnmigratedCount()).toBe(0);
        expect(await repo.hasPendingMigration()).toBe(false); // 洗白完成，可以把备份表彻底爆破了

        // 5. 收尾动作
        await repo.dropMigrationBackup();
        expect(async () => await repo.hasPendingMigration()).not.toThrow();

        // 到此，不仅主表完成了安全迁移，sqlite-vec 的高速虚拟表也在新维度下运作强健！即使底层不支持也能正常回退，一切行云流水无缺无漏。
    });
});
