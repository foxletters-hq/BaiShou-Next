import React from 'react'
import type { InputBarProps, InputBarRef } from './input-bar.types'
import { useInputBar } from './useInputBar'
import { InputBarView } from './InputBarView'

export const InputBar = React.forwardRef<InputBarRef, InputBarProps>((props, ref) => {
  const vm = useInputBar(props, ref)
  return <InputBarView vm={vm} />
})

InputBar.displayName = 'InputBar'
