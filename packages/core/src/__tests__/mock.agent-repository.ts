import { AgentSessionRepository, AgentMessageRepository } from '@baishou/database';
import { AgentSession, AgentMessage } from '@baishou/shared';

export class MockAgentSessionRepository implements AgentSessionRepository {
  public sessions: AgentSession[] = [];

  async findById(id: string): Promise<AgentSession | null> {
    return this.sessions.find(s => s.id === id) || null;
  }

  async create(input: Omit<AgentSession, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentSession> {
    const newSession: AgentSession = {
      ...input,
      id: Math.random().toString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.sessions.push(newSession);
    return newSession;
  }

  async updateTokenUsage(id: string, inputTokens: number, outputTokens: number): Promise<void> {
    const session = this.sessions.find(s => s.id === id);
    if (session) {
      session.totalInputTokens += inputTokens;
      session.totalOutputTokens += outputTokens;
    }
  }
}

export class MockAgentMessageRepository implements AgentMessageRepository {
  public messages: AgentMessage[] = [];

  async findBySessionId(sessionId: string, limit?: number): Promise<AgentMessage[]> {
    const msgs = this.messages.filter(m => m.sessionId === sessionId);
    if (limit) {
      return msgs.slice(-limit);
    }
    return msgs;
  }

  async create(input: Omit<AgentMessage, 'id' | 'createdAt'>): Promise<AgentMessage> {
    const msg: AgentMessage = {
      ...input,
      id: Math.random().toString(),
      createdAt: new Date()
    };
    this.messages.push(msg);
    return msg;
  }
}
