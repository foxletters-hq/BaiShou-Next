declare module 'react-native-zeroconf' {
  export default class Zeroconf {
    constructor()
    publishService(
      type: string,
      protocol: string,
      domain: string,
      name: string,
      port: number,
      txt?: Record<string, string>
    ): void
    unpublishService(name: string): void
    scan(type: string, protocol: string, domain: string): void
    stop(): void
    on(event: string, callback: (...args: any[]) => void): void
    removeListener(event: string, callback: (...args: any[]) => void): void
  }
}
