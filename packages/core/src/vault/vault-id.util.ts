/**
 * 仓库稳定 ID 工具（V2.1）。
 *
 * 移动端 Hermes 无可靠的 `node:crypto`，因此哈希走 `@baishou/shared` 的纯 JS SHA-256。
 * 随机 ID 优先 `crypto.getRandomValues`（Node / 现代 RN 均可用）。
 */

import { sha256Pure } from '@baishou/shared'

const VAULT_ID_PREFIX = 'vlt_'
const VAULT_ID_HEX_LEN = 16

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 存量仓库：由名字确定性派生，多设备独立升级可得同一 ID */
export function deriveLegacyVaultId(name: string): string {
  const hash = sha256Pure(new TextEncoder().encode(name))
  return VAULT_ID_PREFIX + bytesToHex(hash).slice(0, VAULT_ID_HEX_LEN)
}

/** 全新创建的仓库：随机 ID（与名字解耦，支持后续重命名） */
export function createRandomVaultId(): string {
  const bytes = new Uint8Array(VAULT_ID_HEX_LEN / 2)
  const cryptoObj = globalThis.crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  return VAULT_ID_PREFIX + bytesToHex(bytes)
}

export function isVaultId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(VAULT_ID_PREFIX) && value.length > VAULT_ID_PREFIX.length
}
