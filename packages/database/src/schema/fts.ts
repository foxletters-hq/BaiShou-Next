/**
 * 这个文件存放包含创建 FTS5 虚拟表及底层 SQLite Triggers 的原始 SQL 语句。
 * 它需要在数据库初始化阶段被执行（例如在 App 启动连上 SQLite 后，或者作为独立 Migration 运行）。
 */

export const FTS_INIT_SQL = `
-- =======================================================
-- 1. Agent 聊天消息的 FTS5 虚拟表与同步触发器
-- =======================================================

CREATE VIRTUAL TABLE IF NOT EXISTS agent_messages_fts USING fts5(
  part_id UNINDEXED, 
  message_id UNINDEXED, 
  session_id UNINDEXED, 
  content, 
  tokenize='unicode61'
);

-- 插入触发器：自动从 agent_parts 的 JSON 数据中析出 text，并严格对齐 rowid 避免后续删除/更新全表扫描
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_insert
AFTER INSERT ON agent_parts
WHEN NEW.type = 'text'
  AND COALESCE(json_extract(NEW.data, '$.isReasoning'), 0) IN (0, false)
  AND LENGTH(TRIM(COALESCE(json_extract(NEW.data, '$.text'), ''))) > 0
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = NEW.rowid;
  INSERT INTO agent_messages_fts(rowid, part_id, message_id, session_id, content)
  VALUES (NEW.rowid, NEW.id, NEW.message_id, NEW.session_id, json_extract(NEW.data, '$.text'));
END;

-- 更新触发器（按 rowid O(log N) 替换，支持流式输出更新及清空/切为思考内容时同步清理索引）
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_update
AFTER UPDATE OF data ON agent_parts
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = OLD.rowid;
  INSERT INTO agent_messages_fts(rowid, part_id, message_id, session_id, content)
  SELECT NEW.rowid, NEW.id, NEW.message_id, NEW.session_id, json_extract(NEW.data, '$.text')
  WHERE NEW.type = 'text'
    AND COALESCE(json_extract(NEW.data, '$.isReasoning'), 0) IN (0, false)
    AND LENGTH(TRIM(COALESCE(json_extract(NEW.data, '$.text'), ''))) > 0;
END;

-- 删除触发器（按 rowid O(log N) 删除，消除 UNINDEXED part_id 导致的 O(M*N) 全表扫描）
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_delete
AFTER DELETE ON agent_parts
WHEN OLD.type = 'text'
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = OLD.rowid;
END;

-- 针对 message 的级联删除：由于 agent_parts 依赖 message_id 会产生 cascaded delete，上面的 delete trigger 也会自动连锁清理 FTS 表。

-- 只保留 Agent 聊天消息的 FTS 表
`

/** 单条可执行的触发器语句（避免按分号拆分破坏 BEGIN…END 块） */
export const FTS_SYNC_TRIGGER_STATEMENTS = [
  `CREATE TRIGGER IF NOT EXISTS agent_parts_fts_insert
AFTER INSERT ON agent_parts
WHEN NEW.type = 'text'
  AND COALESCE(json_extract(NEW.data, '$.isReasoning'), 0) IN (0, false)
  AND LENGTH(TRIM(COALESCE(json_extract(NEW.data, '$.text'), ''))) > 0
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = NEW.rowid;
  INSERT INTO agent_messages_fts(rowid, part_id, message_id, session_id, content)
  VALUES (NEW.rowid, NEW.id, NEW.message_id, NEW.session_id, json_extract(NEW.data, '$.text'));
END`,
  `CREATE TRIGGER IF NOT EXISTS agent_parts_fts_update
AFTER UPDATE OF data ON agent_parts
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = OLD.rowid;
  INSERT INTO agent_messages_fts(rowid, part_id, message_id, session_id, content)
  SELECT NEW.rowid, NEW.id, NEW.message_id, NEW.session_id, json_extract(NEW.data, '$.text')
  WHERE NEW.type = 'text'
    AND COALESCE(json_extract(NEW.data, '$.isReasoning'), 0) IN (0, false)
    AND LENGTH(TRIM(COALESCE(json_extract(NEW.data, '$.text'), ''))) > 0;
END`,
  `CREATE TRIGGER IF NOT EXISTS agent_parts_fts_delete
AFTER DELETE ON agent_parts
WHEN OLD.type = 'text'
BEGIN
  DELETE FROM agent_messages_fts WHERE rowid = OLD.rowid;
END`
] as const
