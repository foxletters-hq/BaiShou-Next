import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveDiaryHomePath } from '../../components/Sidebar/sidebar-preferences'

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigate(resolveDiaryHomePath(), { replace: true })
  }, [navigate])

  return <div />
}
