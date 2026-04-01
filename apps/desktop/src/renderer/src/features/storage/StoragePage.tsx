import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDriveDownload, CloudLightning, ShieldAlert } from 'lucide-react';

export const StoragePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', 
      alignItems: 'center', justifyContent: 'center', 
      backgroundColor: 'var(--bg-surface-lowest, #F8FAFC)',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      color: 'var(--text-primary, #0F172A)'
    }}>
      <div style={{
        maxWidth: 500, width: '90%', padding: '40px 32px',
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 24,
        boxShadow: '0 12px 48px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(91, 168, 245, 0.3)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', gap: 24
      }}>
         <CloudLightning size={64} color="var(--color-primary, #5BA8F5)" style={{ filter: 'drop-shadow(0 0 16px rgba(91,168,245,0.4))' }} />
         
         <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 12px', letterSpacing: -0.5 }}>云脑接入点已迁移</h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary, #64748B)', lineHeight: 1.6, margin: 0 }}>
               所有关于本地 SQLite 持久化、云端 S3 / WebDAV 神经节快照同步、以及神经向量重载的操作，已被统合进最高级别的安全参数区。
            </p>
         </div>

         <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
            backgroundColor: 'rgba(244, 67, 54, 0.05)', border: '1px solid rgba(244, 67, 54, 0.2)',
            borderRadius: 12, color: 'var(--color-error, #EF4444)', fontSize: 12, fontWeight: 700
         }}>
             <ShieldAlert size={16} /> 这是一条系统性迁移防空洞指令。
         </div>

         <button 
            onClick={() => {
               // 原系统这里或许会通过配置跳转 Settings 的指定 index()，现暂时转往统御设置
               navigate('/settings');
            }}
            style={{
               marginTop: 8,
               display: 'flex', alignItems: 'center', gap: 12,
               padding: '16px 32px', border: 'none', borderRadius: 16,
               background: 'linear-gradient(135deg, var(--color-primary, #5BA8F5), rgba(173,136,212,1))',
               color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
               boxShadow: '0 8px 24px rgba(91, 168, 245, 0.3)',
               transition: 'all 0.2s',
               width: '100%', justifyContent: 'center'
            }}
            onMouseOver={(e) => {
               e.currentTarget.style.transform = 'translateY(-2px)';
               e.currentTarget.style.boxShadow = '0 12px 32px rgba(91, 168, 245, 0.4)';
            }}
            onMouseOut={(e) => {
               e.currentTarget.style.transform = 'translateY(0)';
               e.currentTarget.style.boxShadow = '0 8px 24px rgba(91, 168, 245, 0.3)';
            }}
         >
            <HardDriveDownload size={18} /> 授权开启主控参数台 (Settings)
         </button>
      </div>
    </div>
  )
}
