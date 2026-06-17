/* eslint-disable @typescript-eslint/explicit-function-return-type -- Expo config plugin（CommonJS） */
const { withDangerousMod } = require('@expo/config-plugins')
const path = require('path')

// build 脚本与 prebuild 共用同一份补丁逻辑
const { applyAndroidPlainSplashPatch } = require('../scripts/plain-splash-patch.mjs')

/**
 * 启动屏仅保留纯白背景：透明占位 icon + 禁止系统回退到应用图标（避免暖色闪屏）。
 * 须在 expo-splash-screen 之后；prebuild 后再次打补丁以防其它 mod 覆盖 styles。
 */
function withAndroidPlainSplash(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot
      const androidDir = path.join(projectRoot, 'android')
      applyAndroidPlainSplashPatch(androidDir)
      return config
    }
  ])
}

module.exports = withAndroidPlainSplash
