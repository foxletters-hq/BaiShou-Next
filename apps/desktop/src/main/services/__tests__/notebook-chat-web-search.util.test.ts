import { describe, expect, it } from 'vitest'
import {
  NOTEBOOK_WEB_SEARCH_SYSTEM,
  buildNotebookWebSearchSystem,
  resolveNotebookWebSearchToolIds
} from '../notebook-chat-web-search.util'

describe('notebook-chat-web-search.util', () => {
  it('exposes web_search and url_read only when the shared search switch is on', () => {
    expect(resolveNotebookWebSearchToolIds(true)).toEqual(['web_search', 'url_read'])
    expect(resolveNotebookWebSearchToolIds(false)).toEqual([])
  })

  it('adds web search instructions only when enabled', () => {
    expect(buildNotebookWebSearchSystem(true)).toBe(NOTEBOOK_WEB_SEARCH_SYSTEM)
    expect(buildNotebookWebSearchSystem(false)).toBe('')
  })
})
