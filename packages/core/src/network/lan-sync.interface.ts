// 跨平台局域网同步基类抽象
export interface DiscoveredDevice {
  nickname: string;
  ip: string;
  port: number;
  deviceType: 'mobile' | 'desktop' | 'other';
  rawServiceId: string;
}

export interface ILanSyncService {
  /**
   * 启动被动发现雷达（mDNS广播），使自己对局域网可见。
   * 同时启动本地微型 HTTP 服务器等待对方 Push 数据包。
   * 必须随机绑定到一个高位空闲端口 0 来避免端口死锁。
   * 返回实际暴露在局域网的 IP 与 端口。
   */
  startBroadcasting(): Promise<{ ip: string; port: number } | null>;

  /**
   * 关闭雷达广播和关闭 HTTP 服务器。
   */
  stopBroadcasting(): Promise<void>;

  /**
   * 开启探索周边设备的雷达。
   * 会通过 mDNS 轮询 _baishou._tcp。
   */
  startDiscovery(onDeviceFound: (device: DiscoveredDevice) => void, onDeviceLost: (deviceId: string) => void): Promise<void>;

  /**
   * 关闭探索。
   */
  stopDiscovery(): Promise<void>;

  /**
   * 以客户端身份，向探索到的指定 Endpoint (IP + 端口) POST 发送当前设备的全量 ZIP 数据包。
   * 返回 boolean 结果（是否发送成功并收到对方 200 HTTP 落地确认）
   */
  sendFile(ip: string, port: number, onProgress?: (percent: number) => void): Promise<boolean>;

  /**
   * 注册本地事件回调：当底层 HTTP Server 在后台收到了局域网对端发来的 POST ZIP 包，触发此钩子（交由前端出弹窗）。
   */
  onFileReceived(callback: (zipFilePath: string) => void): void;
}
