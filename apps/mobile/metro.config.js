const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [...(config.watchFolders || []), workspaceRoot]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules')
]

config.resolver.assetExts.push('wasm')

const originalGetPolyfills = config.serializer.getPolyfills
config.serializer.getPolyfills = (ctx) => {
  const polyfills = originalGetPolyfills ? originalGetPolyfills(ctx) : []
  return [path.resolve(projectRoot, 'polyfill.js'), ...polyfills]
}

// 仅对仍可能由传递依赖引入的 Node 内置模块做兜底；共用文件服务已走 IFileSystem + Expo
const nodeBuiltinPrefixes = ['crypto', 'os', 'stream', 'buffer', 'util', 'zlib']
const mockPath = path.resolve(projectRoot, 'mocks/node-modules.js')

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(`${path.resolve(workspaceRoot, 'apps/desktop').replace(/[/\\]/g, '[/\\\\]')}.*`),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/index.desktop.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/fs/node-file-system.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/fs/create-node-file-system.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/sync').replace(/[/\\]/g, '[/\\\\]')}.*`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/core/src/import/legacy-import.service.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/index.desktop.ts').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/connection.manager').replace(/[/\\]/g, '[/\\\\]')}.*`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/shadow-index.connection.manager').replace(/[/\\]/g, '[/\\\\]')}`
  ),
  new RegExp(
    `${path.resolve(workspaceRoot, 'packages/database/src/drivers/node-sqlite.driver').replace(/[/\\]/g, '[/\\\\]')}.*`
  )
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith('node:') ||
    nodeBuiltinPrefixes.some((p) => moduleName === p || moduleName.startsWith(p + '/'))
  ) {
    return {
      filePath: mockPath,
      type: 'sourceFile'
    }
  }
  if (context.resolveRequest) {
    return context.resolveRequest(context, moduleName, platform)
  }
  return null
}

module.exports = config
