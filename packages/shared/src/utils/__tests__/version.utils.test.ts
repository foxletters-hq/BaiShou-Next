import { describe, it, expect } from 'vitest'
import {
  buildNextMarketingVersion,
  formatAppVersion,
  normalizeAppVersionNumber,
  toElectronSemver
} from '../version.utils'

describe('normalizeAppVersionNumber / toElectronSemver', () => {
  it('accepts bare semver from version.json', () => {
    expect(normalizeAppVersionNumber('1.0.0')).toBe('1.0.0')
    expect(toElectronSemver('1.2.3')).toBe('1.2.3')
  })

  it('strips legacy Next prefix', () => {
    expect(toElectronSemver('Next-1.0.0')).toBe('1.0.0')
    expect(toElectronSemver('Next 1.2.3')).toBe('1.2.3')
  })

  it('normalizes v-prefixed strings', () => {
    expect(toElectronSemver('v4.0.0')).toBe('4.0.0')
    expect(toElectronSemver('2.0.0-Canary')).toBe('2.0.0-Canary')
  })

  it('falls back when no semver is found', () => {
    expect(toElectronSemver('')).toBe('0.0.0')
    expect(toElectronSemver('beta')).toBe('0.0.0')
  })
})

describe('buildNextMarketingVersion', () => {
  it('hardcodes Next and uses flexible numbers', () => {
    expect(buildNextMarketingVersion('1.0.0')).toBe('Next-1.0.0')
    expect(buildNextMarketingVersion('2.3.4')).toBe('Next-2.3.4')
  })
})

describe('formatAppVersion', () => {
  it('formats bare semver as Next line display', () => {
    expect(formatAppVersion('1.0.0')).toBe('Next 1.0.0')
    expect(formatAppVersion('4.0.0')).toBe('Next 4.0.0')
  })

  it('formats legacy Next-prefixed strings', () => {
    expect(formatAppVersion('Next-1.0.0')).toBe('Next 1.0.0')
    expect(formatAppVersion('vvNext-1.0.0')).toBe('Next 1.0.0')
  })

  it('returns empty string when version is missing', () => {
    expect(formatAppVersion(undefined)).toBe('')
    expect(formatAppVersion(null)).toBe('')
    expect(formatAppVersion('')).toBe('')
  })

  it('keeps prerelease suffix in display', () => {
    expect(formatAppVersion('2.0.0-Canary')).toBe('Next 2.0.0-Canary')
  })
})
