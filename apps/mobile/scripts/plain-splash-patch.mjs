import fs from 'node:fs'
import path from 'node:path'

const TRANSPARENT_SPLASH_LOGO = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="@android:color/transparent"/>
  <size android:width="1dp" android:height="1dp"/>
</shape>
`

const PLAIN_LAUNCHER_BG = `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background"/>
</layer-list>
`

const SPLASH_STYLE_ITEMS = `    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="windowSplashScreenIconBackgroundColor">@color/splashscreen_background</item>`

/**
 * 启动屏仅纯白底：透明占位 icon 阻止系统回退到应用图标（暖色动漫图会偏红）。
 * @param {string} styles
 */
function patchSplashStyles(styles) {
  let next = styles
  next = next.replace(/\s*<item name="windowSplashScreenAnimatedIcon">[^<]*<\/item>\s*/g, '\n')
  next = next.replace(
    /\s*<item name="windowSplashScreenIconBackgroundColor">[^<]*<\/item>\s*/g,
    '\n'
  )
  next = next.replace(
    /\s*<item name="android:windowSplashScreenBehavior"[^>]*>[^<]*<\/item>\s*/g,
    '\n'
  )

  if (next.includes('windowSplashScreenBackground')) {
    next = next.replace(
      /(<item name="windowSplashScreenBackground">[^<]*<\/item>)/,
      `$1\n${SPLASH_STYLE_ITEMS}`
    )
  }

  if (!next.includes('android:windowBackground')) {
    next = next.replace(
      /(<style name="AppTheme"[^>]*>)/,
      `$1\n    <item name="android:windowBackground">@color/splashscreen_background</item>`
    )
  }

  return next
}

/**
 * 去掉启动屏居中 Logo，并补齐 expo 仍引用的 splashscreen_logo（透明占位）。
 * @param {string} androidDir apps/mobile/android
 */
export function applyAndroidPlainSplashPatch(androidDir) {
  const resDir = path.join(androidDir, 'app/src/main/res')

  const logoPath = path.join(resDir, 'drawable/splashscreen_logo.xml')
  fs.mkdirSync(path.dirname(logoPath), { recursive: true })
  fs.writeFileSync(logoPath, TRANSPARENT_SPLASH_LOGO, 'utf8')

  const launcherBgPath = path.join(resDir, 'drawable/ic_launcher_background.xml')
  if (fs.existsSync(launcherBgPath)) {
    fs.writeFileSync(launcherBgPath, PLAIN_LAUNCHER_BG, 'utf8')
  }

  const stylesPath = path.join(resDir, 'values/styles.xml')
  if (fs.existsSync(stylesPath)) {
    const styles = patchSplashStyles(fs.readFileSync(stylesPath, 'utf8'))
    fs.writeFileSync(stylesPath, styles, 'utf8')
  }
}
