import React from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { MdAdd } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'
import type { AIModelServicesViewModel } from './useAIModelServicesView'
import { ProviderSortableItem, ProviderStaticItem } from './ProviderListItems'

export interface AIModelServicesProviderPaneProps {
  vm: AIModelServicesViewModel
}

export const AIModelServicesProviderPane: React.FC<AIModelServicesProviderPaneProps> = ({ vm }) => {
  const {
    t,
    sensors,
    handleDragStart,
    handleDragEnd,
    localProvidersList,
    selectedProviderId,
    setSelectedProviderId,
    providers,
    activeDragId,
    renderIcon,
    handleAddCustomProvider
  } = vm

  return (
    <div className={styles.leftPane}>
      <div className={styles.listHeader}>{t('ai_config.providers_label', '服务提供商')}</div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
      >
        <div className={styles.listScroll}>
          <SortableContext
            items={localProvidersList.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            {localProvidersList.map((p) => {
              const isActive = selectedProviderId === p.id
              const provConfig = providers[p.id]
              const isEnabled = provConfig ? provConfig.enabled : false
              return (
                <ProviderSortableItem
                  key={p.id}
                  p={p}
                  isActive={isActive}
                  isEnabled={isEnabled}
                  onClick={() => setSelectedProviderId(p.id)}
                  renderIcon={renderIcon}
                  t={(key, fallback) => t(key, fallback ?? '')}
                />
              )
            })}
          </SortableContext>
        </div>
        {createPortal(
          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: '0.4' } }
              })
            }}
          >
            {activeDragId
              ? (() => {
                  const p = localProvidersList.find((x) => x.id === activeDragId)
                  if (!p) return null
                  const isActive = selectedProviderId === p.id
                  const provConfig = providers[p.id]
                  const isEnabled = provConfig ? provConfig.enabled : false
                  return (
                    <ProviderStaticItem
                      p={p}
                      isActive={isActive}
                      isEnabled={isEnabled}
                      renderIcon={renderIcon}
                      t={(key, fallback) => t(key, fallback ?? '')}
                    />
                  )
                })()
              : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
      <div className={styles.listFooter}>
        <button className={styles.addButton} onClick={handleAddCustomProvider}>
          <MdAdd size={18} />
          <span>{t('agent.provider.add_button', '添加')}</span>
        </button>
      </div>
    </div>
  )
}
