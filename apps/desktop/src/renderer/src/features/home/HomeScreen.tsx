import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveFirstVisibleSidebarPath } from '../../components/Sidebar/sidebar-preferences'

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(resolveFirstVisibleSidebarPath(), { replace: true })
  }, [navigate])

  return <div />
}
