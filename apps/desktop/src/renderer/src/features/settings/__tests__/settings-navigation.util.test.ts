import { describe, expect, it, beforeEach } from 'vitest'
import {
  locationToReturnPath,
  rememberSettingsReturnPath,
  resolveSettingsReturnPath,
  settingsOverlayRoutesLocation
} from '../settings-navigation.util'

describe('settings-navigation.util', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('remembers a notebook detail path and returns it from settings', () => {
    rememberSettingsReturnPath('/agent-workspace/knowledge/nb-1')
    expect(resolveSettingsReturnPath()).toBe('/agent-workspace/knowledge/nb-1')
  })

  it('ignores settings and hub paths when remembering return', () => {
    rememberSettingsReturnPath('/agent-workspace/knowledge/nb-1')
    rememberSettingsReturnPath('/settings/general')
    rememberSettingsReturnPath('/hub/general')
    expect(resolveSettingsReturnPath()).toBe('/agent-workspace/knowledge/nb-1')
  })

  it('builds a return path from location search', () => {
    expect(locationToReturnPath({ pathname: '/chat', search: '?assistantId=a1' })).toBe(
      '/chat?assistantId=a1'
    )
  })

  it('keeps the settings overlay location while visible', () => {
    const location = { pathname: '/settings/general', search: '', hash: '', key: 's1' }
    expect(settingsOverlayRoutesLocation(true, location)).toBe(location)
  })

  it('moves overlay routes off /settings/* when hidden so SettingsPage unmounts', () => {
    const location = { pathname: '/settings/general', search: '', hash: '', key: 's1' }
    const idle = settingsOverlayRoutesLocation(false, location)
    expect(idle.pathname.startsWith('/settings')).toBe(false)
    expect(idle.pathname.startsWith('/hub')).toBe(false)
  })
})
