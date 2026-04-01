import { AppDatabase } from '../types';
import { agentSessionsTable } from '../schema/agent-sessions';
import { agentMessagesTable as messagesTbl } from '../schema/agent-messages';
import { agentPartsTable as partsTbl } from '../schema/agent-parts';
import { eq, desc } from 'drizzle-orm';

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
}

export interface InsertPartInput {
  id: string;
  messageId: string;
  sessionId: string;
  type: 'text' | 'tool' | 'stepFinish' | 'compaction';
  data: any;
}

export class SessionRepository {
  constructor(private readonly db: AppDatabase) {}

  /**
   * 创建或更新 Session
   */
  async upsertSession(input: InsertSessionInput): Promise<void> {
    await this.db.insert(agentSessionsTable).values({
      id: input.id,
      title: input.title,
      vaultName: input.vaultName,
      assistantId: input.assistantId,
      systemPrompt: input.systemPrompt,
      providerId: input.providerId,
      modelId: input.modelId,
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
    await this.db.transaction(async (tx) => {
      // 1. 写入主 Message 行
      await tx.insert(messagesTbl).values({
        id: message.id,
        sessionId: message.sessionId,
        role: message.role,
        isSummary: message.isSummary ?? false,
        orderIndex: message.orderIndex,
        createdAt: new Date()
      }).onConflictDoNothing();

      // 2. 级联写入 Parts 
      // 这里的 .values({ data: p.data }) 会被 drizzle sqlite 自动转为 JSON 字符串，触发我们写的 json_extract trigger
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
      
      // 3. 顺便更新 Session 的更新时间
      await tx.update(agentSessionsTable)
        .set({ updatedAt: new Date() })
        .where(eq(agentSessionsTable.id, message.sessionId));
    });
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
  async findAllSessions() {
    return await this.db.select()
      .from(agentSessionsTable)
      .orderBy(
        desc(agentSessionsTable.isPinned),
        desc(agentSessionsTable.updatedAt)
      );
  }

  /**
   * 批量删除会话
   */
  async deleteSessions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    // In drizzle sqlite, we can use inArray
    const { inArray } = await import('drizzle-orm');
    await this.db.transaction(async (tx) => {
      await tx.delete(agentSessionsTable).where(inArray(agentSessionsTable.id, ids));
      await tx.delete(messagesTbl).where(inArray(messagesTbl.sessionId, ids));
      await tx.delete(partsTbl).where(inArray(partsTbl.sessionId, ids));
    });
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
  async upsertAggregate(aggregate: any): Promise<void> {
     const { session, messages } = aggregate;
     
     await this.db.transaction(async (tx) => {
        // 更新会话自身
        await tx.insert(agentSessionsTable).values(session).onConflictDoUpdate({
           target: [agentSessionsTable.id],
           set: {
              title: session.title,
              vaultName: session.vaultName,
              assistantId: session.assistantId,
              isPinned: session.isPinned,
              systemPrompt: session.systemPrompt,
              providerId: session.providerId,
              modelId: session.modelId,
              totalInputTokens: session.totalInputTokens,
              totalOutputTokens: session.totalOutputTokens,
              totalCostMicros: session.totalCostMicros,
              updatedAt: new Date(session.updatedAt) // assure Date object
           }
        });

        // 强压替换法：由于 Messages 和 Parts 会有很多微小的变动，直接清理该 Session 的子级再重新插入
        await tx.delete(messagesTbl).where(eq(messagesTbl.sessionId, session.id));
        await tx.delete(partsTbl).where(eq(partsTbl.sessionId, session.id));

        if (messages && messages.length > 0) {
           const msgsInsert = messages.map((m: any) => ({
              id: m.id,
              sessionId: m.sessionId,
              role: m.role,
              isSummary: m.isSummary ?? false,
              orderIndex: m.orderIndex,
              createdAt: new Date(m.createdAt),
           }));
           await tx.insert(messagesTbl).values(msgsInsert);

           const allParts: any[] = [];
           for (const m of messages) {
               if (m.parts && m.parts.length > 0) {
                   for (const p of m.parts) {
                       allParts.push({
                           id: p.id,
                           messageId: p.messageId,
                           sessionId: p.sessionId,
                           type: p.type,
                           data: p.data,
                           createdAt: new Date(p.createdAt)
                       });
                   }
               }
           }
           if (allParts.length > 0) {
              await tx.insert(partsTbl).values(allParts);
           }
        }
     });
  }
}
