import { describe, expect, it } from 'vitest'
import {
  areSameProviderRows,
  buildSortedProvidersList,
  nextLocalProvidersList
} from '../sorted-providers-list.util'

const catalog = [
  { id: 'openai', name: 'OpenAI', isSystem: true, sortOrder: 1 },
  { id: 'gemini', name: 'Gemini', isSystem: true, sortOrder: 0 }
]

describe('buildSortedProvidersList', () => {
  it('should put enabled providers first when some are disabled', () => {
    const rows = buildSortedProvidersList(catalog, {
      openai: { enabled: true, sortOrder: 8 },
      gemini: { enabled: false, sortOrder: 0 }
    })

    expect(rows.map((row) => row.id)).toEqual(['openai', 'gemini'])
  })
})

describe('nextLocalProvidersList', () => {
  it('should keep the previous list reference when row fields are unchanged', () => {
    const previous = buildSortedProvidersList(catalog, {
      openai: { enabled: true, sortOrder: 1 }
    })
    const next = buildSortedProvidersList(catalog, {
      openai: { enabled: true, sortOrder: 1 }
    })

    expect(areSameProviderRows(previous, next)).toBe(true)
    expect(nextLocalProvidersList(previous, next)).toBe(previous)
  })

  it('should replace the list when enabled or order changes', () => {
    const previous = buildSortedProvidersList(catalog, {
      openai: { enabled: false, sortOrder: 1 }
    })
    const next = buildSortedProvidersList(catalog, {
      openai: { enabled: true, sortOrder: 1 }
    })

    expect(nextLocalProvidersList(previous, next)).toBe(next)
  })
})
