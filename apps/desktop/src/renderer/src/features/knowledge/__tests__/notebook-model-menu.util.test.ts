import { describe, expect, it } from 'vitest'
import { filterKnowledgeMenuProviders } from '../notebook-model-menu.util'

describe('filterKnowledgeMenuProviders', () => {
  const providers = [
    {
      id: 'p1',
      name: 'One',
      type: 'openai',
      models: ['gpt-4o', 'text-embedding-3-small'],
      enabledModels: ['gpt-4o', 'text-embedding-3-small']
    }
  ]

  it('should keep embedding models only for the embedding picker', () => {
    const rows = filterKnowledgeMenuProviders(providers, 'embedding')
    expect(rows[0]?.enabledModels).toEqual(['text-embedding-3-small'])
  })

  it('should drop embedding models from the chat picker', () => {
    const rows = filterKnowledgeMenuProviders(providers, 'chat')
    expect(rows[0]?.enabledModels).toEqual(['gpt-4o'])
  })
})
