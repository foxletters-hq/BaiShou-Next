import React, { useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, type Location } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SettingsPage } from '../features/settings/SettingsPage'
import styles from './SettingsOverlayHost.module.css'

/** 与 MainLayout 日记↔伙伴切换遮罩同时长 */
const SETTINGS_VEIL_DURATION_S = 0.35
const SETTINGS_VEIL_MS = SETTINGS_VEIL_DURATION_S * 1000

type SettingsOverlayHostProps = {
  visible: boolean
  settingsLocation: Location
  remountKey: number
}

/**
 * 全屏设置 overlay：进入主界面后预挂载；显隐用 visibility，避免 CSS 动画被跳过。
 * 开/关均使用与 MainLayout 相同的「先盖住再淡出」遮罩，而不是让设置页自身 fade。
 * 退出时 surface 变透明，让 veil 淡出后直接露出底层日记/伙伴页（避免白闪）。
 */
export const SettingsOverlayHost: React.FC<SettingsOverlayHostProps> = ({
  visible,
  settingsLocation,
  remountKey
}) => {
  const [paintVisible, setPaintVisible] = useState(visible)
  const [veilKey, setVeilKey] = useState(0)
  const paintVisibleRef = useRef(paintVisible)
  const hideTimerRef = useRef<number | null>(null)
  paintVisibleRef.current = paintVisible

  const exiting = paintVisible && !visible

  useLayoutEffect(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }

    if (visible) {
      setPaintVisible(true)
      setVeilKey((key) => key + 1)
      return
    }

    if (!paintVisibleRef.current) return

    // 关闭：路由已离开，宿主再留一帧播遮罩，结束后真正隐藏
    setVeilKey((key) => key + 1)
    hideTimerRef.current = window.setTimeout(() => {
      setPaintVisible(false)
      hideTimerRef.current = null
    }, SETTINGS_VEIL_MS)

    return () => {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }
  }, [visible])

  return (
    <div
      key={remountKey}
      aria-hidden={!paintVisible}
      className={`${styles.host}${visible ? '' : ` ${styles.hostInactive}`}`}
      style={{
        visibility: paintVisible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none'
      }}
    >
      <div className={`${styles.surfaceCard} ${exiting ? styles.surfaceExiting : ''}`}>
        {/*
          退出过渡时隐藏内容；关闭完成后勿写 visibility:visible，
          否则会盖过 host 的 hidden，形成隐形可点层（易误触设置页「问题反馈」）。
        */}
        <div
          className={styles.surfaceContent}
          style={exiting || !paintVisible ? { visibility: 'hidden' } : undefined}
        >
          <Routes location={settingsLocation}>
            <Route path="/settings/*" element={<SettingsPage />} />
            {/* 预挂载时 location 仍是业务页路径，避免刷 No routes matched */}
            <Route path="*" element={null} />
          </Routes>
        </div>

        {paintVisible ? (
          <motion.div
            key={veilKey}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: SETTINGS_VEIL_DURATION_S, ease: 'easeOut' }}
            className={styles.veil}
          />
        ) : null}
      </div>
    </div>
  )
}
