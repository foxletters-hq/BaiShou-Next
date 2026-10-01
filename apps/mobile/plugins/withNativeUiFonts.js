/* eslint-disable @typescript-eslint/explicit-function-return-type -- 原生配置插件（CommonJS） */
const path = require('node:path')
const withExpoFontsModule = require('expo-font/app.plugin.js')
const withExpoFonts =
  typeof withExpoFontsModule === 'function' ? withExpoFontsModule : withExpoFontsModule.default

const mobileRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(mobileRoot, '../..')

const FAMILIES = [
  {
    fontFamily: 'Noto Sans SC',
    pkg: '@expo-google-fonts/noto-sans-sc',
    files: [
      ['400Regular/NotoSansSC_400Regular.ttf', 400],
      ['500Medium/NotoSansSC_500Medium.ttf', 500],
      ['600SemiBold/NotoSansSC_600SemiBold.ttf', 600]
    ]
  },
  {
    fontFamily: 'Noto Sans TC',
    pkg: '@expo-google-fonts/noto-sans-tc',
    files: [
      ['400Regular/NotoSansTC_400Regular.ttf', 400],
      ['500Medium/NotoSansTC_500Medium.ttf', 500],
      ['600SemiBold/NotoSansTC_600SemiBold.ttf', 600]
    ]
  },
  {
    fontFamily: 'Noto Sans JP',
    pkg: '@expo-google-fonts/noto-sans-jp',
    files: [
      ['400Regular/NotoSansJP_400Regular.ttf', 400],
      ['500Medium/NotoSansJP_500Medium.ttf', 500],
      ['600SemiBold/NotoSansJP_600SemiBold.ttf', 600]
    ]
  },
  {
    fontFamily: 'Noto Sans',
    pkg: '@expo-google-fonts/noto-sans',
    files: [
      ['400Regular/NotoSans_400Regular.ttf', 400],
      ['500Medium/NotoSans_500Medium.ttf', 500],
      ['600SemiBold/NotoSans_600SemiBold.ttf', 600]
    ]
  }
]

function resolveUiFontFile(pkg, relPath) {
  const pkgJson = require.resolve(`${pkg}/package.json`, {
    paths: [mobileRoot, workspaceRoot]
  })
  return path.join(path.dirname(pkgJson), relPath)
}

function buildNativeUiFontConfig() {
  const androidFonts = FAMILIES.map((family) => ({
    fontFamily: family.fontFamily,
    fontDefinitions: family.files.map(([relPath, weight]) => ({
      path: resolveUiFontFile(family.pkg, relPath),
      weight
    }))
  }))
  const iosFonts = androidFonts.flatMap((family) =>
    family.fontDefinitions.map((definition) => definition.path)
  )
  return {
    ios: { fonts: iosFonts },
    android: { fonts: androidFonts }
  }
}

function withNativeUiFonts(config) {
  return withExpoFonts(config, buildNativeUiFontConfig())
}

module.exports = withNativeUiFonts
module.exports.buildNativeUiFontConfig = buildNativeUiFontConfig
module.exports.resolveUiFontFile = resolveUiFontFile
