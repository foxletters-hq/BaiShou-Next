/** @type {import('expo/config').ExpoConfig} */
const base = require('./app.json').expo

/**
 * 正式 Release 打包（BAISHOU_RELEASE_BUILD=1）不注入 expo-dev-client，
 * 避免安装后仍尝试连接 Metro / 开发菜单导致闪退或资源加载失败。
 */
module.exports = () => {
  const isReleaseBuild = process.env.BAISHOU_RELEASE_BUILD === '1'
  if (!isReleaseBuild) {
    return base
  }

  const plugins = base.plugins.filter((plugin) => {
    if (plugin === 'expo-dev-client') return false
    if (Array.isArray(plugin) && plugin[0] === 'expo-dev-client') return false
    return true
  })

  return { ...base, plugins }
}
