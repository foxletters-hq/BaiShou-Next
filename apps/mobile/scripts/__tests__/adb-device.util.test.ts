import { describe, expect, it } from 'vitest'
import {
  formatAdbShellCommand,
  listOfflineTcpSerials,
  parseAdbDevices,
  pickAdbSerial,
  withAdbSerialArgs
} from '../adb-device.util.mjs'

const listing = `
List of devices attached
emulator-5554	device
192.168.31.10:5555	device
ABCD1234	device
EFGH5678	offline
`

describe('parseAdbDevices', () => {
  it('should skip the header and keep serial plus state', () => {
    expect(parseAdbDevices(listing)).toEqual([
      { serial: 'emulator-5554', state: 'device' },
      { serial: '192.168.31.10:5555', state: 'device' },
      { serial: 'ABCD1234', state: 'device' },
      { serial: 'EFGH5678', state: 'offline' }
    ])
  })
})

describe('pickAdbSerial', () => {
  const devices = parseAdbDevices(listing)

  it('should prefer ANDROID_SERIAL when that device is online', () => {
    expect(pickAdbSerial(devices, '192.168.31.10:5555')).toBe('192.168.31.10:5555')
  })

  it('should prefer a USB phone over wireless adb and emulator', () => {
    expect(pickAdbSerial(devices)).toBe('ABCD1234')
  })

  it('should prefer wireless adb over emulator when no USB phone is online', () => {
    expect(
      pickAdbSerial([
        { serial: 'emulator-5554', state: 'device' },
        { serial: '192.168.31.10:5555', state: 'device' }
      ])
    ).toBe('192.168.31.10:5555')
  })

  it('should ignore offline and unauthorized devices', () => {
    expect(
      pickAdbSerial([
        { serial: 'DEAD', state: 'offline' },
        { serial: 'WAIT', state: 'unauthorized' },
        { serial: '192.168.31.10:5555', state: 'device' }
      ])
    ).toBe('192.168.31.10:5555')
  })

  it('should return null when no device is online', () => {
    expect(pickAdbSerial([{ serial: 'DEAD', state: 'offline' }])).toBeNull()
  })
})

describe('listOfflineTcpSerials', () => {
  it('should list offline wireless adb entries', () => {
    expect(
      listOfflineTcpSerials([
        { serial: '192.16.31.10:5555', state: 'offline' },
        { serial: '192.168.31.10:5555', state: 'device' },
        { serial: 'DEADUSB', state: 'offline' }
      ])
    ).toEqual(['192.16.31.10:5555'])
  })
})

describe('withAdbSerialArgs', () => {
  it('should prefix -s when a serial is selected', () => {
    expect(withAdbSerialArgs(['reverse', 'tcp:8081', 'tcp:8081'], 'ABCD1234')).toEqual([
      '-s',
      'ABCD1234',
      'reverse',
      'tcp:8081',
      'tcp:8081'
    ])
  })
})

describe('formatAdbShellCommand', () => {
  it('should insert -s before the rest of the adb command', () => {
    expect(formatAdbShellCommand('192.168.31.10:5555', 'shell am start -p app')).toBe(
      'adb -s 192.168.31.10:5555 shell am start -p app'
    )
  })
})
