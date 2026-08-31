import React from 'react'

export const NotebookCoverIcon: React.FC<{
  name: string
  size?: number
  className?: string
}> = ({ name, className }) => {
  return (
    <span className={className} aria-hidden>
      {name}
    </span>
  )
}
