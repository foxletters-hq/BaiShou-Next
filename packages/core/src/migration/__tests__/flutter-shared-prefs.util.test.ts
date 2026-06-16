import { describe, it, expect } from 'vitest'
import {
  assembleDevicePreferencesFromFlutterSp,
  extractFlutterCustomStorageRoot,
  hasMeaningfulFlutterPreferences,
  parseFlutterSharedPreferencesJson,
  parseFlutterSharedPreferencesPlist,
  parseFlutterSharedPreferencesXml
} from '../flutter-shared-prefs.util'

describe('flutter-shared-prefs.util', () => {
  it('parses flutter json prefs and strips flutter. prefix', () => {
    const sp = parseFlutterSharedPreferencesJson(
      JSON.stringify({
        'flutter.user_nickname': 'Alice',
        'flutter.theme_mode': 2,
        'flutter.ai_providers_list': '[]'
      })
    )
    expect(sp['user_nickname']).toBe('Alice')
    expect(sp['theme_mode']).toBe(2)
  })

  it('parses flutter android xml prefs', () => {
    const xml = `
      <map>
        <string name="flutter.user_nickname">Bob</string>
        <int name="flutter.theme_mode" value="1" />
        <boolean name="flutter.rag_global_enabled" value="true" />
      </map>
    `
    const sp = parseFlutterSharedPreferencesXml(xml)
    expect(sp['user_nickname']).toBe('Bob')
    expect(sp['theme_mode']).toBe(1)
    expect(sp['rag_global_enabled']).toBe(true)
  })

  it('parses flutter ios plist prefs', () => {
    const plist = `
      <?xml version="1.0" encoding="UTF-8"?>
      <plist version="1.0"><dict>
        <key>flutter.user_nickname</key><string>Dana</string>
        <key>flutter.custom_storage_root</key><string>/var/mobile/BaiShou_Root</string>
        <key>flutter.theme_mode</key><integer>2</integer>
        <key>flutter.rag_global_enabled</key><true/>
      </dict></plist>
    `
    const sp = parseFlutterSharedPreferencesPlist(plist)
    expect(sp['user_nickname']).toBe('Dana')
    expect(sp['custom_storage_root']).toBe('/var/mobile/BaiShou_Root')
    expect(sp['theme_mode']).toBe(2)
    expect(sp['rag_global_enabled']).toBe(true)
    expect(extractFlutterCustomStorageRoot(sp)).toBe('/var/mobile/BaiShou_Root')
  })

  it('assembles device preferences from shared preferences map', () => {
    const config = assembleDevicePreferencesFromFlutterSp({
      user_nickname: 'Carol',
      theme_seed_color: 12345,
      ai_providers_list: JSON.stringify([{ id: 'openai', name: 'OpenAI' }]),
      tool_config_web_search: JSON.stringify({ enabled: true }),
      summary_prompt_instructions_weekly: 'weekly prompt'
    })
    expect(config['nickname']).toBe('Carol')
    expect(config['seed_color']).toBe(12345)
    expect(Array.isArray(config['ai_providers_list'])).toBe(true)
    expect(config['all_tool_configs']).toEqual({ web_search: { enabled: true } })
    expect(config['all_summary_instructions']).toEqual({ weekly: 'weekly prompt' })
    expect(hasMeaningfulFlutterPreferences(config)).toBe(true)
  })
})
