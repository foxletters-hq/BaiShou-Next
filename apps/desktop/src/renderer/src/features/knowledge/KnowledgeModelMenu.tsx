import React from 'react'
import { SessionModelMenu } from '@baishou/ui'
import {
  filterKnowledgeMenuProviders,
  type KnowledgeMenuProvider,
  type KnowledgeModelMenuKind
} from './notebook-model-menu.util'

export type KnowledgeModelMenuProps = {
  kind: KnowledgeModelMenuKind
  providers: KnowledgeMenuProvider[]
  currentProviderId?: string
  currentModelId?: string
  anchorRect?: DOMRect | null
  onSelect: (providerId: string, modelId: string) => void
  onClose: () => void
  onManageProviders: () => void
}

export const KnowledgeModelMenu: React.FC<KnowledgeModelMenuProps> = ({
  kind,
  providers,
  currentProviderId,
  currentModelId,
  anchorRect,
  onSelect,
  onClose,
  onManageProviders
}) => {
  return (
    <SessionModelMenu
      onClose={onClose}
      providers={filterKnowledgeMenuProviders(providers, kind)}
      currentProviderId={currentProviderId}
      currentModelId={currentModelId}
      onSelect={onSelect}
      onManageProviders={onManageProviders}
      showReasoningPanel={false}
      anchorRect={anchorRect}
    />
  )
}
