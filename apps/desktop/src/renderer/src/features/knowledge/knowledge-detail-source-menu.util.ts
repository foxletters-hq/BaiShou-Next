import type { ContextMenuItem } from '@baishou/ui'
import type { KnowledgeSourceMenuAction } from './knowledge-source-menu.util'
import type { KnowledgeOcrProgressState, KnowledgeSourceRow } from './knowledge-detail.types'

export function knowledgeSourceMenuOcrRunning(
  source: KnowledgeSourceRow,
  ocrProgress?: KnowledgeOcrProgressState
): boolean {
  const isOcrEngine = source.extractEngine === 'ocr' || source.extractEngine === 'vision'
  return (
    Boolean(ocrProgress) ||
    source.status === 'extracting' ||
    (source.status === 'pending' && isOcrEngine)
  )
}

export function mapKnowledgeDetailSourceMenuItems(
  actions: KnowledgeSourceMenuAction[],
  label: (action: KnowledgeSourceMenuAction) => string,
  run: (action: KnowledgeSourceMenuAction) => void
): ContextMenuItem[] {
  return actions.flatMap((action) => {
    const item: ContextMenuItem =
      action === 'reembed'
        ? {
            label: label(action),
            children: [
              {
                label: label('reembed-vector'),
                onClick: () => run('reembed-vector')
              },
              {
                label: label('reembed-graph'),
                onClick: () => run('reembed-graph')
              }
            ]
          }
        : {
            label: label(action),
            onClick: () => run(action)
          }
    return action === 'delete' ? [{ label: '', divider: true }, item] : [item]
  })
}
