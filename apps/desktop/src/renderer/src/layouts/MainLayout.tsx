import React from 'react'
import { TitleBar } from '../components/TitleBar'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Book, Settings, PieChart, HardDrive } from 'lucide-react'

export const MainLayout: React.FC = () => {
  return (
    <div className="app-container">
      <TitleBar />
      <div className="app-main">
        <nav className="sidebar">
          {/* 侧边栏导航 */}
          <ul
            style={{
              listStyle: 'none',
              padding: '1rem',
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <li>
              <NavLink
                to="/home"
                style={({ isActive }) => ({
                  display: 'flex',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#aaa',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                })}
              >
                <Home size={20} /> 行李箱
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/diary"
                style={({ isActive }) => ({
                  display: 'flex',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#aaa',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                })}
              >
                <Book size={20} /> 双链日记
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/summary"
                style={({ isActive }) => ({
                  display: 'flex',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#aaa',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                })}
              >
                <PieChart size={20} /> 统计洞察
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/storage"
                style={({ isActive }) => ({
                  display: 'flex',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#aaa',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                })}
              >
                <HardDrive size={20} /> 知识库
              </NavLink>
            </li>
            <div style={{ flexGrow: 1 }} />
            <li>
              <NavLink
                to="/settings"
                style={({ isActive }) => ({
                  display: 'flex',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: isActive ? '#fff' : '#aaa',
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent'
                })}
              >
                <Settings size={20} /> 偏好设置
              </NavLink>
            </li>
          </ul>
        </nav>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
