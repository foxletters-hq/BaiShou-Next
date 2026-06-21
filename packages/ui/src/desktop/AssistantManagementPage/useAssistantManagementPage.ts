import { useEffect, useMemo, useState } from 'react'
import {
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { AssistantInfo } from './index'

function sortAssistantsByOrder(list: AssistantInfo[], pinnedIds: Set<string>): AssistantInfo[] {
  return [...list].sort((a, b) => {
    const aPinned = pinnedIds.has(a.id)
    const bPinned = pinnedIds.has(b.id)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  })
}

export function useAssistantManagementPage(
  assistants: AssistantInfo[],
  pinnedIds: Set<string>,
  searchQuery: string,
  onReorder?: (orderedIds: string[]) => void
) {
  const [localAssistants, setLocalAssistants] = useState<AssistantInfo[]>(() =>
    sortAssistantsByOrder(assistants, pinnedIds)
  )
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null)

  useEffect(() => {
    setLocalAssistants(sortAssistantsByOrder(assistants, pinnedIds))
  }, [assistants, pinnedIds])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  const query = searchQuery.trim().toLowerCase()
  const isDragEnabled = query === '' && Boolean(onReorder)

  const visibleAssistants = useMemo(() => {
    if (!query) return localAssistants
    return localAssistants.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.description && a.description.toLowerCase().includes(query))
    )
  }, [localAssistants, query])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
    const width = event.active.rect.current.initial?.width
    setDragOverlayWidth(width && width > 0 ? width : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    setDragOverlayWidth(null)
    if (!onReorder) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localAssistants.findIndex((a) => a.id === active.id)
    const newIndex = localAssistants.findIndex((a) => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(localAssistants, oldIndex, newIndex).map((item, index) => ({
      ...item,
      sortOrder: index
    }))
    setLocalAssistants(next)
    onReorder(next.map((a) => a.id))
  }

  return {
    visibleAssistants,
    isDragEnabled,
    sensors,
    activeDragId,
    dragOverlayWidth,
    handleDragStart,
    handleDragEnd
  }
}
