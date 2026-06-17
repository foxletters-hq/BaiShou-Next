declare module 'react-native-zeroconf' {
  export const ImplType: {
    NSD: 'NSD'
    DNSSD: 'DNSSD'
  }

  export default class Zeroconf {
    constructor()
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>,
      implType?: (typeof ImplType)[keyof typeof ImplType]
    ): void
    unpublishService(name: string, implType?: string): void
    scan(type: string, protocol: string, domain: string, implType?: string): void
    stop(implType?: string): void
    getServices(): Record<string, any>
    on(event: string, callback: (...args: any[]) => void): void
    removeListener(event: string, callback: (...args: any[]) => void): void
  }
}
