import { describe, expect, it, vi, beforeEach } from 'vitest'

const bonjourState = vi.hoisted(() => {
  const constructorOpts: unknown[] = []
  const publishCalls: Array<Record<string, unknown>> = []
  const respondCalls: unknown[][] = []
  const updateCalls: number[] = []

  class MockService {
    public name: string
    public host: string
    public port: number
    public txt: Record<string, unknown>
    public activated = true
    public destroyed = false

    constructor(config: Record<string, unknown>) {
      this.name = String(config.name ?? '')
      this.host = String(config.host ?? 'raw-windows-host')
      this.port = Number(config.port ?? 0)
      this.txt = (config.txt as Record<string, unknown>) ?? {}
    }

    RecordA(_service: unknown, ip: string) {
      return { name: this.host, type: 'A', ttl: 120, data: ip }
    }

    records() {
      return [
        {
          name: '_baishou._tcp.local',
          type: 'PTR',
          ttl: 28800,
          data: `${this.name}._baishou._tcp.local`
        },
        {
          name: `${this.name}._baishou._tcp.local`,
          type: 'SRV',
          ttl: 120,
          data: { port: this.port, target: this.host }
        },
        { name: `${this.name}._baishou._tcp.local`, type: 'TXT', ttl: 4500, data: [] },
        { name: this.host, type: 'A', ttl: 120, data: '198.18.0.1' },
        { name: this.host, type: 'A', ttl: 120, data: '192.168.31.151' }
      ]
    }

    stop() {
      this.activated = false
      this.destroyed = true
    }
  }

  class MockBonjour {
    public server = {
      mdns: {
        respond: (records: unknown[]) => {
          respondCalls.push(records)
        }
      }
    }

    constructor(opts?: unknown) {
      constructorOpts.push(opts)
    }

    publish(config: Record<string, unknown>) {
      publishCalls.push(config)
      return new MockService(config)
    }

    find() {
      return {
        on: vi.fn(),
        update: () => {
          updateCalls.push(Date.now())
        },
        stop: vi.fn()
      }
    }

    destroy() {}
  }

  return {
    constructorOpts,
    publishCalls,
    respondCalls,
    updateCalls,
    MockBonjour,
    MockService
  }
})

vi.mock('bonjour-service', () => ({
  Bonjour: bonjourState.MockBonjour,
  Browser: class {},
  Service: bonjourState.MockService
}))

import { LanDiscovery } from '../services/LanDiscovery'

describe('LanDiscovery', () => {
  beforeEach(() => {
    bonjourState.constructorOpts.length = 0
    bonjourState.publishCalls.length = 0
    bonjourState.respondCalls.length = 0
    bonjourState.updateCalls.length = 0
  })

  it('publishes with .local host, binds multicast interface to LAN IP, and filters A records to preferred LAN IPs', () => {
    const discovery = new LanDiscovery()

    const service = discovery.publish(
      'BaiShou-Anson-5678abcd',
      54321,
      {
        nickname: 'Anson',
        ip: '192.168.31.151',
        device_type: 'desktop',
        dtype: 'desktop',
        device_id: 'desktop-12345678-abcd'
      },
      {
        interfaceIp: '192.168.31.151',
        ips: ['192.168.31.151']
      }
    )

    expect(bonjourState.constructorOpts[0]).toEqual({
      interface: '192.168.31.151',
      bind: '0.0.0.0'
    })
    expect(bonjourState.publishCalls[0]).toMatchObject({
      name: 'BaiShou-Anson-5678abcd',
      port: 54321,
      probe: false,
      disableIPv6: true
    })
    expect(String(bonjourState.publishCalls[0]?.host)).toMatch(/\.local$/)

    const records = service.records()
    const aRecords = records.filter((r: { type: string }) => r.type === 'A')
    expect(aRecords).toEqual([
      {
        name: bonjourState.publishCalls[0]?.host,
        type: 'A',
        ttl: 120,
        data: '192.168.31.151'
      }
    ])

    discovery.destroy()
  })

  it('reannounces published records when triggering discovery requery', () => {
    const discovery = new LanDiscovery()
    discovery.publish(
      'BaiShou-Anson-5678abcd',
      54321,
      {
        nickname: 'Anson',
        ip: '192.168.31.151',
        device_id: 'desktop-12345678-abcd'
      },
      {
        interfaceIp: '192.168.31.151',
        ips: ['192.168.31.151']
      }
    )

    discovery.startDiscovery('BaiShou-Anson-5678abcd', vi.fn(), vi.fn(), '192.168.31.151')

    expect(bonjourState.updateCalls.length).toBeGreaterThanOrEqual(1)
    expect(bonjourState.respondCalls.length).toBeGreaterThanOrEqual(1)

    discovery.destroy()
  })
})
