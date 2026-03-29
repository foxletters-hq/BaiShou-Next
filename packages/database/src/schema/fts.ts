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

-- 插入触发器：自动从 agent_parts 的 JSON 数据中析出 text
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_insert
AFTER INSERT ON agent_parts
WHEN NEW.type = 'text'
BEGIN
  INSERT INTO agent_messages_fts(part_id, message_id, session_id, content) 
  VALUES (NEW.id, NEW.message_id, NEW.session_id, json_extract(NEW.data, '$.text'));
END;

-- 更新触发器（支持 AI 流式输出时的全量刷新）
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_update
AFTER UPDATE OF data ON agent_parts
WHEN NEW.type = 'text'
BEGIN
  UPDATE agent_messages_fts 
  SET content = json_extract(NEW.data, '$.text') 
  WHERE part_id = NEW.id;
END;

-- 删除触发器
CREATE TRIGGER IF NOT EXISTS agent_parts_fts_delete
AFTER DELETE ON agent_parts
WHEN OLD.type = 'text'
BEGIN
  DELETE FROM agent_messages_fts WHERE part_id = OLD.id;
END;

-- 针对 message 的级联删除：由于 agent_parts 依赖 message_id 会产生 cascaded delete，上面的 delete trigger 也会自动连锁清理 FTS 表。

-- =======================================================
-- 2. 日记的 FTS5 虚拟表与同步触发器
-- =======================================================

CREATE VIRTUAL TABLE IF NOT EXISTS diaries_fts USING fts5(
  diary_id UNINDEXED,
  content,
  tags,
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS diaries_fts_insert
AFTER INSERT ON diaries
BEGIN
  INSERT INTO diaries_fts(diary_id, content, tags) 
  VALUES (NEW.id, NEW.content, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS diaries_fts_update
AFTER UPDATE OF content, tags ON diaries
BEGIN
  UPDATE diaries_fts 
  SET content = NEW.content, tags = NEW.tags 
  WHERE diary_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS diaries_fts_delete
AFTER DELETE ON diaries
BEGIN
  DELETE FROM diaries_fts WHERE diary_id = OLD.id;
END;
`;
