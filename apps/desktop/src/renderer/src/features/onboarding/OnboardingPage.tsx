import React from 'react'

export const OnboardingPage: React.FC = () => {
  return (
    <div className="glass-panel" style={{ margin: '2rem', textAlign: 'center' }}>
      <h1>欢迎来到 BaiShou Next</h1>
      <p>这是一个全屏的初始化与新手指引流程页面。</p>
      <button style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>
        开始体验
      </button>
    </div>
  )
}
