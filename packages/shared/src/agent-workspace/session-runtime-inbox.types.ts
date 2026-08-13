/** Session Runtime inbox：用户输入投递方式 */
export type SessionInputDelivery = 'steer' | 'queue'

/** inbox 条目状态 */
export type SessionInputStatus = 'pending' | 'promoted' | 'cancelled' | 'failed'

export interface SessionInputRecord {
  id: string
  sessionId: string
  delivery: SessionInputDelivery
  text: string
  status: SessionInputStatus
  userMessageId?: string
  admittedAt: number
  admittedSeq: number
  promotedAt?: number
  /** 宿主额外载荷（provider/model/searchMode 等） */
  payload?: Record<string, unknown>
}

export interface AdmitSessionInputParams {
  sessionId: string
  text: string
  delivery?: SessionInputDelivery
  userMessageId?: string
  payload?: Record<string, unknown>
}
