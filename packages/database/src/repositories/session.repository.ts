import { AppDatabase } from '../types';
import { agentSessionsTable } from '../schema/agent-sessions';
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages';
import { agentPartsTable as partsTbl } from '../schema/agent-parts';
import { eq, desc, or, isNull } from 'drizzle-orm';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface InsertSessionInput {
  id: string;
  title?: string;
  vaultName: string;
  assistantId?: string;
  systemPrompt?: string;
  providerId: string;
  modelId: string;
}

export interface InsertMessageInput {
  id: string;
  sessionId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  isSummary?: boolean;
  orderIndex: number;
  inputTokens?: number;
  outputTokens?: number;
  costMicros?: number;
  providerId?: string;
  modelId?: string;
}

export interface InsertPartInput {
  id: string;
  messageId: string;
  sessionId: string;
  type: 'text' | 'tool' | 'stepFinish' | 'compaction';
  data: any;
}

export class SessionRepository {
  private static writeMutex: Promise<void> = Promise.resolve();
  constructor(private readonly db: AppDatabase) {}

  /**
   * 创建或更新 Session
   */
  async upsertSession(input: InsertSessionInput): Promise<void> {
    const vaultName = input.vaultName || 'default';
    const providerId = input.providerId || 'default';
    const modelId = input.modelId || 'default';

    await this.db.insert(agentSessionsTable).values({
      id: input.id,
      title: input.title,
      vaultName: vaultName,
      assistantId: input.assistantId,
      systemPrompt: input.systemPrompt,
      providerId: providerId,
      modelId: modelId,
      updatedAt: new Date()
    }).onConflictDoUpdate({
      target: [agentSessionsTable.id],
      set: {
        title: input.title,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * 原子化写入 Message 和其挂载的 Parts
   * 这将触发底层的 after_part_insert 使得 FTS5 引擎热更新
   */
  async insertMessageWithParts(message: InsertMessageInput, parts: InsertPartInput[]): Promise<void> {
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined;

    if (isBetterSqlite) {
      this.db.transaction((tx) => {
        tx.insert(messagesTbl).values({
          id: message.id,
          sessionId: message.sessionId,
          role: message.role,
          isSummary: message.isSummary ?? false,
          orderIndex: message.orderIndex,
          inputTokens: message.inputTokens,
          outputTokens: message.outputTokens,
          costMicros: message.costMicros,
          providerId: message.providerId,
          modelId: message.modelId,
          createdAt: new Date()
        }).onConflictDoNothing().run();

        if (parts.length > 0) {
          tx.insert(partsTbl).values(parts.map(p => ({
            id: p.id,
            messageId: p.messageId,
            sessionId: p.sessionId,
            type: p.type,
            data: p.data,
            createdAt: new Date()
          }))).run();
        }

        tx.update(agentSessionsTable)
          .set({ updatedAt: new Date() })
          .where(eq(agentSessionsTable.id, message.sessionId))
          .run();
      });
    } else {
      await this.db.transaction(async (tx) => {
        // 1. 写入主 Message 行
        await tx.insert(messagesTbl).values({
          id: message.id,
          sessionId: message.sessionId,
          role: message.role,
          isSummary: message.isSummary ?? false,
          orderIndex: message.orderIndex,
          inputTokens: message.inputTokens,
          outputTokens: message.outputTokens,
          costMicros: message.costMicros,
          providerId: message.providerId,
          modelId: message.modelId,
          createdAt: new Date()
        }).onConflictDoNothing();

        // 2. 级联写入 Parts
        if (parts.length > 0) {
          await tx.insert(partsTbl).values(parts.map(p => ({
            id: p.id,
            messageId: p.messageId,
            sessionId: p.sessionId,
            type: p.type,
            data: p.data,
            createdAt: new Date()
          })));
        }

        // 3. 更新 Session 的更新时间
        await tx.update(agentSessionsTable)
          .set({ updatedAt: new Date() })
          .where(eq(agentSessionsTable.id, message.sessionId));
      });
    }
  }

  /**
   * 更新模型用量流耗散的 Tokens 与其对于美元微单位 (`micros`) 的总花销。
   * 此更新方式为利用 SQLite 后台进行增量原子累加以确保安全。
   */
  async updateTokenUsage(id: string, inputTokens: number, outputTokens: number, costMicros: number = 0): Promise<void> {
    const { sql } = await import('drizzle-orm');
    await this.db.update(agentSessionsTable)
      .set({ 
        totalInputTokens: sql`${agentSessionsTable.totalInputTokens} + ${inputTokens}`,
        totalOutputTokens: sql`${agentSessionsTable.totalOutputTokens} + ${outputTokens}`,
        totalCostMicros: sql`${agentSessionsTable.totalCostMicros} + ${costMicros}`,
        updatedAt: new Date() 
      })
      .where(eq(agentSessionsTable.id, id));
  }

  /**
   * 获取会话的消息体历史
   */
  async getMessagesBySession(sessionId: string, limit: number = 50) {
    const rawMessages = await this.db.select()
      .from(messagesTbl)
      .where(eq(messagesTbl.sessionId, sessionId))
      .orderBy(desc(messagesTbl.orderIndex))
      .limit(limit);

    rawMessages.reverse(); // 从老到新

    // 获取他们所有的 Parts
    if (rawMessages.length === 0) return [];
    
    // 我们在这里做 N+1 简化，或者用 IN 批量拉，这里暂时拉出当前 Session 所有 Parts
    const allParts = await this.db.select()
      .from(partsTbl)
      .where(eq(partsTbl.sessionId, sessionId));

    return rawMessages.map(msg => ({
      ...msg,
      parts: allParts.filter(p => p.messageId === msg.id)
    }));
  }

  /**
   * 查询所有会话（按置顶和更新时间排序）
   */
  async findAllSessions(limit: number = 20, offset: number = 0, assistantId?: string) {
    let q = this.db.select().from(agentSessionsTable);
    if (assistantId) {
       q = q.where(or(
         eq(agentSessionsTable.assistantId, assistantId),
         isNull(agentSessionsTable.assistantId)
       )) as any;
    }
    const finalQuery = q.orderBy(
        desc(agentSessionsTable.isPinned),
        desc(agentSessionsTable.updatedAt)
      )
      .limit(limit)
      .offset(offset);
      
    const results = await finalQuery;
    console.log(`[SessionRepo] findAllSessions(limit=${limit}, offset=${offset}, astId=${assistantId}) => returned ${results.length} rows.`);
    if (results.length === 0) {
       // 如果查出来是空，顺便查一下表里总共有多少数据，看看是不是条件过滤导致的
       const allDocs = await this.db.select().from(agentSessionsTable);
       console.log(`[SessionRepo] WARNING: Returned 0, but total rows in DB: ${allDocs.length}`);
       if (allDocs.length > 0) {
            console.log(`[SessionRepo] The first row in DB has assistantId:`, allDocs[0]!.assistantId);
       }
    }
    return results;
  }

  /**
   * 按 ID 单独更新标题
   */
  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    await this.db.update(agentSessionsTable)
      .set({ title, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, sessionId));
  }

  /**
   * 批量删除会话
   */
  async deleteSessions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { inArray } = await import('drizzle-orm');
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined;

    if (isBetterSqlite) {
      this.db.transaction((tx) => {
        tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids)).run();
        tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids)).run();
        tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids)).run();
      });
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids));
        await tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids));
        await tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids));
      });
    }
  }

  /**
   * 根据 ID 删除单条消息
   */
  async deleteMessage(_sessionId: string, messageId: string): Promise<void> {
    const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined;

    if (isBetterSqlite) {
      this.db.transaction((tx) => {
        tx.delete(partsTbl).where(eq(partsTbl.messageId, messageId)).run();
        tx.delete(messagesTbl).where(eq(messagesTbl.id, messageId)).run();
      });
    } else {
      await this.db.transaction(async (tx) => {
        await tx.delete(partsTbl).where(eq(partsTbl.messageId, messageId));
        await tx.delete(messagesTbl).where(eq(messagesTbl.id, messageId));
      });
    }
  }

  /**
   * 删除消息及其后续所有内容
   */
  async deleteMessageAndFollowing(sessionId: string, messageId: string): Promise<void> {
    const { and, gte, inArray } = await import('drizzle-orm');
    const msg = await this.db.select().from(messagesTbl).where(eq(messagesTbl.id, messageId)).limit(1);
    if (!msg.length) return;
    
    const toDelete = await this.db.select().from(messagesTbl).where(and(eq(messagesTbl.sessionId, sessionId), gte(messagesTbl.orderIndex, msg[0]!.orderIndex)));
    const ids = toDelete.map(m => m.id);
    if (ids.length > 0) {
      const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined;
      if (isBetterSqlite) {
        this.db.transaction((tx) => {
          tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids)).run();
          tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids)).run();
        });
      } else {
        await this.db.transaction(async (tx) => {
          await tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids));
          await tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids));
        });
      }
    }
  }

  /**
   * Retrieves a single message by ID
   */
  async getMessageById(messageId: string): Promise<any> {
    const rows = await this.db.select().from(messagesTbl).where(eq(messagesTbl.id, messageId)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Deletes all messages strictly AFTER the given orderIndex
   */
  async deleteMessagesAfter(sessionId: string, orderIndex: number): Promise<void> {
    const { and, gt, inArray } = await import('drizzle-orm');
    const toDelete = await this.db.select().from(messagesTbl).where(and(eq(messagesTbl.sessionId, sessionId), gt(messagesTbl.orderIndex, orderIndex)));
    const ids = toDelete.map(m => m.id);
    if (ids.length > 0) {
      const isBetterSqlite = (this.db as any).session?.client?.prepare !== undefined;
      if (isBetterSqlite) {
        this.db.transaction((tx) => {
          tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids)).run();
          tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids)).run();
        });
      } else {
        await this.db.transaction(async (tx) => {
          await tx.delete(partsTbl).where(inArray(partsTbl.messageId, ids));
          await tx.delete(messagesTbl).where(inArray(messagesTbl.id, ids));
        });
      }
    }
  }

  /**
   * Updates only the text content part of a specific message
   */
  async updateMessageTextPart(messageId: string, newText: string): Promise<void> {
    const { and } = await import('drizzle-orm');
    const rows = await this.db.select().from(partsTbl).where(and(eq(partsTbl.messageId, messageId), eq(partsTbl.type, 'text')));
    if (rows.length > 0) {
       await this.db.update(partsTbl)
         .set({ data: { text: newText } })
         .where(eq(partsTbl.id, rows[0]!.id));
    } else {
       const parent = await this.db.select().from(messagesTbl).where(eq(messagesTbl.id, messageId)).limit(1);
       if (parent.length > 0) {
          await this.db.insert(partsTbl).values({
             id: generateUUID(),
             messageId,
             sessionId: parent[0]!.sessionId,
             type: 'text',
             data: { text: newText },
             createdAt: new Date()
          });
       }
    }
  }

  /**
   * 获取单一会话
   */
  async getSessionById(sessionId: string): Promise<any> {
    const docs = await this.db.select().from(agentSessionsTable).where(eq(agentSessionsTable.id, sessionId)).limit(1);
    return docs.length > 0 ? docs[0] : null;
  }

  /**
   * 切换会话置顶状态
   */
  async togglePin(id: string, isPinned: boolean): Promise<void> {
    await this.db.update(agentSessionsTable)
      .set({ isPinned, updatedAt: new Date() })
      .where(eq(agentSessionsTable.id, id));
  }

  /**
   * 按 ID 批量更新 Parts 的内部数据（用于压缩剪枝抹去过时的巨大长文）
   */
  async updatePartsDataFallback(partIds: string[], fallbackData: any): Promise<void> {
    if (partIds.length === 0) return;
    const { inArray } = await import('drizzle-orm');
    await this.db.update(partsTbl)
      .set({ data: fallbackData })
      .where(inArray(partsTbl.id, partIds));
  }

  /**
   * 读取完整的 Session 结构体
   */
  async getSessionAggregate(sessionId: string): Promise<any | null> {
    const sessionDoc = await this.db.select().from(agentSessionsTable).where(eq(agentSessionsTable.id, sessionId)).limit(1);
    if (!sessionDoc.length) return null;
    const session = sessionDoc[0];

    const messages = await this.db.select().from(messagesTbl).where(eq(messagesTbl.sessionId, sessionId));
    // Drizzle default sort is preserving order index if insert by order, or we can just sort in memory:
    messages.sort((a,b) => a.orderIndex - b.orderIndex);

    const parts = await this.db.select().from(partsTbl).where(eq(partsTbl.sessionId, sessionId));

    const enrichedMessages = messages.map(m => ({
        ...m,
        parts: parts.filter(p => p.messageId === m.id)
    }));

    return { session, messages: enrichedMessages };
  }

  /**
   * 将同步来的物理 File (JSON Aggregate) 倒灌或者幂等替换到 DB 缓存。
   */
  /**
   * 将 JSON 中的时间戳（可能是秒级或毫秒级）统一转换为 Date 对象
   */
  private _toDate(ts: any): Date {
    if (ts instanceof Date) return isNaN(ts.getTime()) ? new Date() : ts;
    const n = Number(ts);
    if (!isNaN(n)) {
      // 秒级时间戳（10位）转毫秒；毫秒级（13位）直接用
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    // ISO 字符串
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  /**
   * 互斥包装层：确保即使并发调用 upsertAggregate，也严格排队执行。
   * 彻底避免 libsql 多实例/多异步上下文抢占同一个句柄导致的 SQLITE_CORRUPT
   */
  async upsertAggregate(aggregate: any): Promise<void> {
     const unlock = await this._acquireMutex();
     try {
        await this._upsertAggregateInternal(aggregate);
     } finally {
        unlock();
     }
  }

  private _acquireMutex(): Promise<() => void> {
     let release: () => void;
     const newMutex = new Promise<void>((resolve) => {
        release = resolve;
     });
     const oldMutex = SessionRepository.writeMutex;
     SessionRepository.writeMutex = oldMutex.then(() => newMutex);
     return oldMutex.then(() => release);
  }

  private async _upsertAggregateInternal(aggregate: any): Promise<void> {
     const { session, messages } = aggregate;

     // 获取原始 client 以便进行多态 batch 事务提交
     const rawClient = (this.db as any).$client;

     const toUnixSec = (ts: any): number => {
        const d = this._toDate(ts);
        return Math.floor(d.getTime() / 1000);
     };

     const stmts: Array<{ sql: string; args?: any[] }> = [];

     // 1. 删除旧 session（ON DELETE CASCADE 自动清理 messages 和 parts）
     stmts.push({ sql: 'DELETE FROM agent_sessions WHERE id = ?', args: [session.id] });

     // 2. 重新插入 session
     stmts.push({
        sql: `INSERT INTO agent_sessions
              (id, title, vault_name, assistant_id, is_pinned, system_prompt,
               provider_id, model_id, total_input_tokens, total_output_tokens,
               total_cost_micros, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
           session.id,
           session.title ?? null,
           session.vaultName ?? null,
           session.assistantId ?? null,
           session.isPinned ? 1 : 0,
           session.systemPrompt ?? null,
           session.providerId ?? null,
           session.modelId ?? null,
           session.totalInputTokens ?? null,
           session.totalOutputTokens ?? null,
           session.totalCostMicros ?? null,
           toUnixSec(session.createdAt),
           toUnixSec(session.updatedAt),
        ]
     });

     // 3. 插入 messages 和 parts
     if (messages && messages.length > 0) {
        for (const m of messages) {
           stmts.push({
              sql: `INSERT OR IGNORE INTO agent_messages
                    (id, session_id, role, is_summary, order_index, created_at)
                    VALUES (?,?,?,?,?,?)`,
              args: [
                 m.id,
                 m.sessionId,
                 m.role,
                 m.isSummary ? 1 : 0,
                 m.orderIndex,
                 toUnixSec(m.createdAt),
              ]
           });

           if (m.parts && m.parts.length > 0) {
              for (const p of m.parts) {
                 const dataStr = typeof p.data === 'string'
                   ? p.data
                   : JSON.stringify(p.data ?? null);
                 stmts.push({
                    sql: `INSERT OR IGNORE INTO agent_parts
                          (id, message_id, session_id, type, data, created_at)
                          VALUES (?,?,?,?,?,?)`,
                    args: [
                       p.id,
                       p.messageId,
                       p.sessionId,
                       p.type,
                       dataStr,
                       toUnixSec(p.createdAt),
                    ]
                 });
              }
           }
        }
     }

     // 4. 一次性多态批量提交所有语句，单次 prepare/execute 往返
     if (rawClient && typeof rawClient.batch === 'function') {
        // LibSQL 驱动路径
        await rawClient.batch(stmts);
     } else if (rawClient) {
        // Better-SQLite3 / 标准 Node-SQLite 驱动路径：使用同步高性能事务
        const runTx = rawClient.transaction((statements: typeof stmts) => {
           for (const stmt of statements) {
              rawClient.prepare(stmt.sql).run(...(stmt.args || []));
           }
        });
        runTx(stmts);
     }
  }
}
