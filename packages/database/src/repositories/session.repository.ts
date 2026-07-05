import type { AppDatabase } from '../types'
import { SessionAggregateSync } from './session.repository.aggregate'
import { SessionMessageOps } from './session.repository.messages'
import { SessionCrudOps } from './session.repository.sessions'
import { withExpoAgentDatabaseLock } from './session.repository.utils'

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

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return withExpoAgentDatabaseLock(this.db, fn)
  }

  upsertSession(...args: Parameters<SessionCrudOps['upsertSession']>) {
    return this.run(() => this.crudOps.upsertSession(...args))
  }

  insertMessageWithParts(...args: Parameters<SessionMessageOps['insertMessageWithParts']>) {
    return this.run(() => this.messageOps.insertMessageWithParts(...args))
  }

  updateTokenUsage(...args: Parameters<SessionCrudOps['updateTokenUsage']>) {
    return this.run(() => this.crudOps.updateTokenUsage(...args))
  }

  getMessagesBySession(...args: Parameters<SessionMessageOps['getMessagesBySession']>) {
    return this.run(() => this.messageOps.getMessagesBySession(...args))
  }

  findAllSessions(...args: Parameters<SessionCrudOps['findAllSessions']>) {
    return this.run(() => this.crudOps.findAllSessions(...args))
  }

  updateSessionTitle(...args: Parameters<SessionCrudOps['updateSessionTitle']>) {
    return this.run(() => this.crudOps.updateSessionTitle(...args))
  }

  updateSessionDialogueModel(...args: Parameters<SessionCrudOps['updateSessionDialogueModel']>) {
    return this.run(() => this.crudOps.updateSessionDialogueModel(...args))
  }

  deleteSessions(...args: Parameters<SessionCrudOps['deleteSessions']>) {
    return this.run(() => this.crudOps.deleteSessions(...args))
  }

  deleteMessage(...args: Parameters<SessionMessageOps['deleteMessage']>) {
    return this.run(() => this.messageOps.deleteMessage(...args))
  }

  deleteMessageAndFollowing(...args: Parameters<SessionMessageOps['deleteMessageAndFollowing']>) {
    return this.run(() => this.messageOps.deleteMessageAndFollowing(...args))
  }

  getMessageById(...args: Parameters<SessionMessageOps['getMessageById']>) {
    return this.run(() => this.messageOps.getMessageById(...args))
  }

  deleteMessagesAfter(...args: Parameters<SessionMessageOps['deleteMessagesAfter']>) {
    return this.run(() => this.messageOps.deleteMessagesAfter(...args))
  }

  updateMessageTextPart(...args: Parameters<SessionMessageOps['updateMessageTextPart']>) {
    return this.run(() => this.messageOps.updateMessageTextPart(...args))
  }

  upsertCompactionMarker(...args: Parameters<SessionMessageOps['upsertCompactionMarker']>) {
    return this.run(() => this.messageOps.upsertCompactionMarker(...args))
  }

  messageHasCompactionMarker(...args: Parameters<SessionMessageOps['messageHasCompactionMarker']>) {
    return this.run(() => this.messageOps.messageHasCompactionMarker(...args))
  }

  clearCompactionMarkersFromOrderIndex(
    ...args: Parameters<SessionMessageOps['clearCompactionMarkersFromOrderIndex']>
  ) {
    return this.run(() => this.messageOps.clearCompactionMarkersFromOrderIndex(...args))
  }

  getSessionById(...args: Parameters<SessionCrudOps['getSessionById']>) {
    return this.run(() => this.crudOps.getSessionById(...args))
  }

  togglePin(...args: Parameters<SessionCrudOps['togglePin']>) {
    return this.run(() => this.crudOps.togglePin(...args))
  }

  updatePartsDataFallback(...args: Parameters<SessionCrudOps['updatePartsDataFallback']>) {
    return this.run(() => this.crudOps.updatePartsDataFallback(...args))
  }

  updatePartsDataById(...args: Parameters<SessionCrudOps['updatePartsDataById']>) {
    return this.run(() => this.crudOps.updatePartsDataById(...args))
  }

  getSessionAggregate(...args: Parameters<SessionAggregateSync['getSessionAggregate']>) {
    return this.run(() => this.aggregateSync.getSessionAggregate(...args))
  }

  upsertAggregate(...args: Parameters<SessionAggregateSync['upsertAggregate']>) {
    return this.run(() => this.aggregateSync.upsertAggregate(...args))
  }
}
