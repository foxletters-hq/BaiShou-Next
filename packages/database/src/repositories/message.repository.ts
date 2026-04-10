import { eq, desc, asc } from 'drizzle-orm';
import { AgentMessageRepository } from './agent.repository';
import { AgentMessage, AgentPart } from '@baishou/shared';
import { AppDatabase } from '../types';
import { agentMessagesTable } from '../schema/agent-messages';
import { agentPartsTable } from '../schema/agent-parts';

export type InsertAgentMessageInput = Omit<AgentMessage, 'createdAt'>;
export type InsertAgentPartInput = Omit<AgentPart, 'createdAt'>;

export class MessageRepository implements AgentMessageRepository {
  constructor(private readonly db: AppDatabase) {}

  async findBySessionId(sessionId: string, limit: number = 20, offset: number = 0): Promise<AgentMessage[]> {
    const rows = await this.db.select()
      .from(agentMessagesTable)
      .where(eq(agentMessagesTable.sessionId, sessionId))
      .orderBy(desc(agentMessagesTable.orderIndex))
      .limit(limit)
      .offset(offset);

    return rows.reverse().map(row => ({
      ...row,
      role: row.role as AgentMessage['role'],
      askId: row.askId ?? undefined,
      providerId: row.providerId ?? undefined,
      modelId: row.modelId ?? undefined,
      inputTokens: row.inputTokens ?? undefined,
      outputTokens: row.outputTokens ?? undefined,
      costMicros: row.costMicros ?? undefined,
      createdAt: row.createdAt
    }));
  }

  async getPartsByMessageId(messageId: string): Promise<AgentPart[]> {
    const rows = await this.db.select()
      .from(agentPartsTable)
      .where(eq(agentPartsTable.messageId, messageId))
      .orderBy(asc(agentPartsTable.createdAt));
      
    return rows.map(r => ({
      ...r,
      type: r.type as AgentPart['type']
    }));
  }

  async create(input: InsertAgentMessageInput): Promise<AgentMessage> {
    const [inserted] = await this.db.insert(agentMessagesTable)
      .values({
        id: input.id,
        sessionId: input.sessionId,
        role: input.role,
        isSummary: input.isSummary,
        askId: input.askId,
        providerId: input.providerId,
        modelId: input.modelId,
        orderIndex: input.orderIndex,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicros: input.costMicros,
      })
      .returning();
      
    if (!inserted) throw new Error('Failed to insert message');
      
    return {
      ...inserted,
      role: inserted.role as AgentMessage['role'],
      askId: inserted.askId ?? undefined,
      providerId: inserted.providerId ?? undefined,
      modelId: inserted.modelId ?? undefined,
      inputTokens: inserted.inputTokens ?? undefined,
      outputTokens: inserted.outputTokens ?? undefined,
      costMicros: inserted.costMicros ?? undefined,
    };
  }

  async createPart(input: InsertAgentPartInput): Promise<AgentPart> {
    const [inserted] = await this.db.insert(agentPartsTable)
      .values({
        id: input.id,
        messageId: input.messageId,
        sessionId: input.sessionId,
        type: input.type,
        data: input.data
      })
      .returning();
      
    if (!inserted) throw new Error('Failed to insert message part');
      
    return {
      ...inserted,
      type: inserted.type as AgentPart['type']
    };
  }

  async searchMessagesByKeyword(keyword: string, limit: number = 10): Promise<any[]> {
    const { sql } = await import('drizzle-orm');
    const rows = await this.db.select({
       role: agentMessagesTable.role,
       content: agentPartsTable.data,
       createdAt: agentMessagesTable.createdAt,
       sessionTitle: sql<string>`(SELECT title FROM sessions WHERE id = ${agentMessagesTable.sessionId})`
    })
    .from(agentMessagesTable)
    .innerJoin(agentPartsTable, eq(agentMessagesTable.id, agentPartsTable.messageId))
    .where(sql`json_extract(${agentPartsTable.data}, '$.text') LIKE ${'%' + keyword + '%'}`)
    .orderBy(desc(agentMessagesTable.createdAt))
    .limit(limit);
    
    return rows.map(r => ({
       role: r.role,
       content: (r.content as any)?.text || '',
       sessionTitle: r.sessionTitle,
       createdAt: r.createdAt
    }));
  }
}
