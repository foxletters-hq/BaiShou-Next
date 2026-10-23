import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { applyAndroidPlainSplashPatch } from '../plain-splash-patch.mjs'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

function fakeAndroidProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'plain-splash-'))
  dirs.push(root)
  const res = join(root, 'app/src/main/res')
  mkdirSync(join(res, 'drawable'), { recursive: true })
  mkdirSync(join(res, 'values'), { recursive: true })
  writeFileSync(
    join(res, 'drawable/ic_launcher_background.xml'),
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android"></layer-list>\n',
    'utf8'
  )
  writeFileSync(
    join(res, 'values/styles.xml'),
    `<resources>
  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
  </style>
</resources>
`,
    'utf8'
  )
  return root
}

describe('applyAndroidPlainSplashPatch', () => {
  it('should write splashscreen_logo drawable when expo styles reference it', () => {
    const androidDir = fakeAndroidProject()
    applyAndroidPlainSplashPatch(androidDir)
    const logoPath = join(androidDir, 'app/src/main/res/drawable/splashscreen_logo.xml')
    expect(existsSync(logoPath)).toBe(true)
    expect(readFileSync(logoPath, 'utf8')).toContain('android:color="@android:color/transparent"')
  })
})
