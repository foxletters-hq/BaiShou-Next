import { describe, expect, it } from 'vitest'
import { Brain, Network, Share2 } from 'lucide-react'
import { USED_LUCIDE_ICON_NAMES } from '../used-lucide-icons'
import { buildIconGallerySections, entryMatchesQuery } from '../icon-gallery-catalog'

const lucideIcons = { Brain, Network, Share2 }

describe('buildIconGallerySections', () => {
  it('keeps used icons in their lucide categories instead of filtering them out', () => {
    const sections = buildIconGallerySections({ lucideIcons })
    const used = sections.find((section) => section.id === 'used')
    const medical = sections.find((section) => section.id === 'medical')
    const science = sections.find((section) => section.id === 'science')

    expect(used?.items.some((item) => item.name === 'Brain')).toBe(true)
    expect(used?.groups?.some((group) => group.items.some((item) => item.name === 'Brain'))).toBe(
      true
    )
    expect(medical?.items.some((item) => item.name === 'Brain')).toBe(true)
    expect(science?.items.some((item) => item.name === 'Brain')).toBe(true)
  })

  it('groups used icons by their first lucide category', () => {
    const sections = buildIconGallerySections({ lucideIcons })
    const used = sections.find((section) => section.id === 'used')
    const medical = used?.groups?.find((group) => group.id === 'medical')
    expect(medical?.items.map((item) => item.name)).toContain('Brain')
    expect(used?.groups?.filter((group) => group.id === 'science') ?? []).toHaveLength(0)
  })

  it('does not remove a category hit just because the icon is already in the used group', () => {
    const sections = buildIconGallerySections({ lucideIcons, query: 'brain' })
    const used = sections.find((section) => section.id === 'used')
    const medical = sections.find((section) => section.id === 'medical')
    expect(used?.items.map((item) => item.name)).toContain('Brain')
    expect(medical?.items.map((item) => item.name)).toContain('Brain')
  })

  it('matches icon names and tags', () => {
    expect(entryMatchesQuery({ name: 'Network', tags: ['share'] }, 'net')).toBe(true)
    expect(entryMatchesQuery({ name: 'Network', tags: ['share'] }, 'share')).toBe(true)
    expect(entryMatchesQuery({ name: 'Network', tags: ['share'] }, 'zzzz')).toBe(false)
  })

  it('lists unique used icon names', () => {
    expect(new Set(USED_LUCIDE_ICON_NAMES).size).toBe(USED_LUCIDE_ICON_NAMES.length)
  })
})
