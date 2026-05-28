declare module 'react-native-zeroconf' {
  export default class Zeroconf {
    constructor()
    publish(
      name: string,
      type: string,
      protocol: string,
      domain: string,
      port: number,
      txt?: Record<string, string>
    ): void
    unpublishService(type: string): void
    scan(type: string, protocol: string, domain: string): void
    stop(): void
    on(event: string, callback: (...args: any[]) => void): void
    removeListener(event: string, callback: (...args: any[]) => void): void
  }
}
