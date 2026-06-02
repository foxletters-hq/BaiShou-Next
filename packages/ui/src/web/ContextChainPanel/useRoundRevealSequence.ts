import React from 'react'
import type { CallChainRoundGroup } from './call-chain-panel.types'

/** 轮次展开：无过渡动画，点击即显示全部预览 */
export function useRoundRevealSequence(_roundGroups: CallChainRoundGroup[]) {
  const [expandedRounds, setExpandedRounds] = React.useState<Set<number>>(() => new Set())

  const expandRoundWithSequence = React.useCallback((roundIndex: number) => {
    setExpandedRounds(new Set([roundIndex]))
  }, [])

  const collapseRound = React.useCallback((roundIndex: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev)
      next.delete(roundIndex)
      return next
    })
  }, [])

  const collapseAll = React.useCallback(() => {
    setExpandedRounds(new Set())
  }, [])

  const isRoundExpanded = React.useCallback(
    (roundIndex: number) => expandedRounds.has(roundIndex),
    [expandedRounds]
  )

  const getVisibleMessages = React.useCallback(
    (group: CallChainRoundGroup) =>
      isRoundExpanded(group.roundIndex) ? group.messages : [],
    [isRoundExpanded]
  )

  return {
    expandedRounds,
    roundReveal: null,
    isRevealing: false,
    expandRoundWithSequence,
    collapseRound,
    collapseAll,
    isRoundExpanded,
    getVisibleMessages
  }
}
