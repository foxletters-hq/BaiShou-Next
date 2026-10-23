/** 公开目录里可被 UI/请求使用的思考分档记录（只收 effort） */

export type ReasoningCatalogRecord = {
  values: string[]
}

export type ReasoningCatalogPayload = {
  syncedAt?: string
  source?: string
  byProvider: Record<string, Record<string, ReasoningCatalogRecord>>
  byModelId: Record<string, ReasoningCatalogRecord>
}

export function emptyReasoningCatalogPayload(): ReasoningCatalogPayload {
  return { byProvider: {}, byModelId: {} }
}
