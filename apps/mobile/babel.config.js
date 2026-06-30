module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: [
      [
        'react-native-worklets/plugin',
        {
          bundleMode: true,
          workletizableModules: ['remend']
        }
      ],
      'react-native-reanimated/plugin'
    ]
  }
}
