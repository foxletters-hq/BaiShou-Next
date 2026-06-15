/**
 * 桌面端应用版本唯一来源。
 * version.json 只存 semver 数字（如 1.0.0）；产品线前缀 Next 在代码中固定拼接。
 * 修改后请运行 `pnpm sync:app-version` 同步 package.json。
 */
import { buildNextMarketingVersion } from '@baishou/shared'
import versionManifest from './version.json'

/** 纯 semver，供 electron / package.json */
export const APP_VERSION_NUMBER = versionManifest.version

/** 营销版本：Next-1.0.0 */
export const APP_VERSION = buildNextMarketingVersion(APP_VERSION_NUMBER)
