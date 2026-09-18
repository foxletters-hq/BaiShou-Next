import {
  normalizeNotebookCoverIcon,
  normalizeNotebookCoverImage,
  normalizeNotebookCoverTone
} from '@baishou/shared'
import type { NotebookRawRecord } from '../raw-data/managers/notebook.raw-manager'

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${rand}`
}

export function extOf(fileName: string): string {
  const i = fileName.lastIndexOf('.')
  return i >= 0 ? fileName.slice(i).toLowerCase() : ''
}

export function byteLengthUtf8(text: string): number {
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8')
  return new TextEncoder().encode(text).length
}

export function requireVaultId(getVaultId: () => string): string {
  const id = getVaultId()?.trim() || ''
  if (!id) throw new Error('vaultId is required for knowledge ingest')
  return id
}

export function toNotebookRawRecord(row: {
  id: string
  name: string
  description?: string | null
  createdAt: number
  updatedAt: number
  sortOrder?: number
  coverTone?: string | null
  coverIcon?: string | null
  coverImage?: string | null
}): NotebookRawRecord {
  const coverTone = normalizeNotebookCoverTone(row.coverTone)
  const coverIcon = normalizeNotebookCoverIcon(row.coverIcon)
  const coverImage = normalizeNotebookCoverImage(row.id, row.coverImage)
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: null,
    sortOrder: row.sortOrder ?? 0,
    ...(coverTone ? { coverTone } : {}),
    ...(coverIcon ? { coverIcon } : {}),
    ...(coverImage ? { coverImage } : {})
  }
}
