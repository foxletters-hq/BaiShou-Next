module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      // Reanimated 4.3+ 的 plugin 即 worklets/plugin，不可与 react-native-worklets/plugin 重复注册
      [
        'react-native-reanimated/plugin',
        {
          bundleMode: true,
          workletizableModules: ['remend']
        }
      ]
    ]
  }
}
