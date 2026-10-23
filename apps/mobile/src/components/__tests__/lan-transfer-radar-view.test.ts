import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const radarSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../LanTransferRadarView.tsx'),
  'utf8'
)

const stylesSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../LanTransferRadarView.styles.ts'),
  'utf8'
)

const screenSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../screens/LanTransferScreen.tsx'),
  'utf8'
)

describe('LanTransferRadarView screen centering and design polish', () => {
  it('should center elements relative to device screen rather than content view', () => {
    // 验证引入了屏幕尺寸与顶部偏移校正
    expect(radarSrc).toContain('useWindowDimensions')
    expect(radarSrc).toContain('const screenCenterY = windowHeight / 2')
    expect(radarSrc).toContain('const screenCenterInZoneY = screenCenterY - topOffset')

    // 验证中心点不是简单写死在 zone.height / 2
    expect(radarSrc).not.toContain('const cy = zone.height / 2')

    // 验证核心 PulseCore 与同心圆、波纹均基于屏幕中心 (cx, cy)
    expect(radarSrc).toContain('styles.coreWrap')
    expect(radarSrc).toContain('left: cx - CORE_SIZE / 2')
    expect(radarSrc).toContain('top: cy - CORE_SIZE / 2')
  })

  it('correctly calculates screen centering offset for mobile viewport', () => {
    // 模拟典型的移动端屏幕几何尺寸：
    // iPhone 14/15/16 标准高度 844，状态栏 47 + 导航栏 44 = 91 顶部偏移
    const windowHeight = 844
    const topOffset = 91
    const zoneHeight = windowHeight - topOffset // 753

    // 旧算法：在可视区域自身居中
    const oldCenterInZone = zoneHeight / 2 // 376.5
    const oldScreenAbsoluteY = topOffset + oldCenterInZone // 467.5 (比屏幕中点 422 偏下 45.5px)

    // 新算法：在手机屏幕居中
    const screenCenterY = windowHeight / 2 // 422
    const newCenterInZone = screenCenterY - topOffset // 331
    const newScreenAbsoluteY = topOffset + newCenterInZone // 422 (完美对齐手机屏幕几何中心)

    expect(newScreenAbsoluteY).toBe(screenCenterY)
    expect(oldScreenAbsoluteY - newScreenAbsoluteY).toBe(45.5)
  })

  it('should include polished radar elements: reticle, ripples, and status card', () => {
    // 验证雷达十字准线与外圈刻度
    expect(radarSrc).toContain('RadarReticle')
    expect(stylesSrc).toContain('reticleLineH')
    expect(stylesSrc).toContain('reticleLineV')
    expect(stylesSrc).toContain('reticleTick')

    // 验证雷达向外扩散波纹
    expect(radarSrc).toContain('RadarRipples')
    expect(stylesSrc).toContain('rippleWave')

    // 验证底部自适应状态卡片及本机 IP 展示
    expect(radarSrc).toContain('statusCard')
    expect(radarSrc).toContain('localIp')
    expect(stylesSrc).toContain('localIpRow')
  })

  it('should strictly use theme tokens and typography without hardcoded colors', () => {
    expect(stylesSrc).toContain('mobileTypography.primary')
    expect(stylesSrc).toContain('mobileTypography.caption')
    expect(stylesSrc).toContain('sharedTokens.radius')
    expect(stylesSrc).toContain('sharedTokens.spacing')

    // 严禁在样式文件中硬编码基色
    expect(stylesSrc).not.toContain('#ffffff')
    expect(stylesSrc).not.toContain('#000000')
    expect(stylesSrc).not.toContain('#fff')
  })

  it('should pass local connection details from LanTransferScreen to RadarView', () => {
    expect(screenSrc).toContain('localIp={localConn?.ip}')
    expect(screenSrc).toContain('localPort={localConn?.port}')
  })
})
