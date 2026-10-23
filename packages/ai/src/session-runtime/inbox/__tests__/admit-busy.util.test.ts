import { describe, expect, it } from 'vitest'
import { resolveAdmitStartDecision } from '../admit-busy.util'

describe('resolveAdmitStartDecision', () => {
  it('should queue when stream claim is busy even if forceStart is true', () => {
    expect(
      resolveAdmitStartDecision({
        forceStart: true,
        hostMarkedBusy: true,
        streamClaimBusy: true
      })
    ).toEqual({ action: 'queue', clearHostBusyMark: false })
  })

  it('should queue when host is busy and forceStart is false', () => {
    expect(
      resolveAdmitStartDecision({
        forceStart: false,
        hostMarkedBusy: true,
        streamClaimBusy: false
      })
    ).toEqual({ action: 'queue', clearHostBusyMark: false })
  })

  it('should clear stale host busy mark and start when forceStart and claim is idle', () => {
    expect(
      resolveAdmitStartDecision({
        forceStart: true,
        hostMarkedBusy: true,
        streamClaimBusy: false
      })
    ).toEqual({ action: 'start', clearHostBusyMark: true })
  })

  it('should start when both host and claim are idle', () => {
    expect(
      resolveAdmitStartDecision({
        forceStart: true,
        hostMarkedBusy: false,
        streamClaimBusy: false
      })
    ).toEqual({ action: 'start', clearHostBusyMark: false })
  })
})
