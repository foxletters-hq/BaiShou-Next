import type { AppDatabase } from '../types'
import { SessionAggregateSync } from './session.repository.aggregate'
import { SessionMessageOps } from './session.repository.messages'
import { SessionCrudOps } from './session.repository.sessions'

export type {
  InsertSessionInput,
  InsertMessageInput,
  InsertPartInput
} from './session.repository.types'

export class SessionRepository {
  private readonly crudOps: SessionCrudOps
  private readonly messageOps: SessionMessageOps
  private readonly aggregateSync: SessionAggregateSync

  constructor(public readonly db: AppDatabase) {
    this.crudOps = new SessionCrudOps(db)
    this.messageOps = new SessionMessageOps(db)
    this.aggregateSync = new SessionAggregateSync(db)
  }

  upsertSession(...args: Parameters<SessionCrudOps['upsertSession']>) {
    return this.crudOps.upsertSession(...args)
  }

  insertMessageWithParts(...args: Parameters<SessionMessageOps['insertMessageWithParts']>) {
    return this.messageOps.insertMessageWithParts(...args)
  }

  updateTokenUsage(...args: Parameters<SessionCrudOps['updateTokenUsage']>) {
    return this.crudOps.updateTokenUsage(...args)
  }

  getMessagesBySession(...args: Parameters<SessionMessageOps['getMessagesBySession']>) {
    return this.messageOps.getMessagesBySession(...args)
  }

  findAllSessions(...args: Parameters<SessionCrudOps['findAllSessions']>) {
    return this.crudOps.findAllSessions(...args)
  }

  updateSessionTitle(...args: Parameters<SessionCrudOps['updateSessionTitle']>) {
    return this.crudOps.updateSessionTitle(...args)
  }

  deleteSessions(...args: Parameters<SessionCrudOps['deleteSessions']>) {
    return this.crudOps.deleteSessions(...args)
  }

  deleteMessage(...args: Parameters<SessionMessageOps['deleteMessage']>) {
    return this.messageOps.deleteMessage(...args)
  }

  deleteMessageAndFollowing(...args: Parameters<SessionMessageOps['deleteMessageAndFollowing']>) {
    return this.messageOps.deleteMessageAndFollowing(...args)
  }

  getMessageById(...args: Parameters<SessionMessageOps['getMessageById']>) {
    return this.messageOps.getMessageById(...args)
  }

  deleteMessagesAfter(...args: Parameters<SessionMessageOps['deleteMessagesAfter']>) {
    return this.messageOps.deleteMessagesAfter(...args)
  }

  updateMessageTextPart(...args: Parameters<SessionMessageOps['updateMessageTextPart']>) {
    return this.messageOps.updateMessageTextPart(...args)
  }

  getSessionById(...args: Parameters<SessionCrudOps['getSessionById']>) {
    return this.crudOps.getSessionById(...args)
  }

  togglePin(...args: Parameters<SessionCrudOps['togglePin']>) {
    return this.crudOps.togglePin(...args)
  }

  updatePartsDataFallback(...args: Parameters<SessionCrudOps['updatePartsDataFallback']>) {
    return this.crudOps.updatePartsDataFallback(...args)
  }

  getSessionAggregate(...args: Parameters<SessionAggregateSync['getSessionAggregate']>) {
    return this.aggregateSync.getSessionAggregate(...args)
  }

  upsertAggregate(...args: Parameters<SessionAggregateSync['upsertAggregate']>) {
    return this.aggregateSync.upsertAggregate(...args)
  }
}
