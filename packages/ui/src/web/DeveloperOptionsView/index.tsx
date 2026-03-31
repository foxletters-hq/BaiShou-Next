import React from 'react';

export const DeveloperOptionsView: React.FC = () => {
  return (
    <div style={{ 
      padding: '32px 24px', 
      borderRadius: 16, 
      background: 'rgba(255,255,255,0.02)', 
      border: '1px dashed rgba(255,255,255,0.1)' 
    }}>
      <h3 style={{ marginBottom: 12, fontSize: 18, fontWeight: 600 }}>🛠 实验性特性与高级调试</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
        您即将踏入赛博最深处：这涉及白守底层的内存压测截断、特级 IPC 通信拦截器以及未公开的局域网高频探嗅功能。请谨慎操作。<br />
        <span style={{ color: '#4ade80' }}>（敬请期待后续实验仓释出）</span>
      </p>
    </div>
  );
};
