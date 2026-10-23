import React from 'react'
import { Navigate } from 'react-router-dom'
import { resolveDiaryHomePath } from '../../components/Sidebar/sidebar-preferences'

export const HomeScreen: React.FC = () => {
  return <Navigate to={resolveDiaryHomePath()} replace />
}
