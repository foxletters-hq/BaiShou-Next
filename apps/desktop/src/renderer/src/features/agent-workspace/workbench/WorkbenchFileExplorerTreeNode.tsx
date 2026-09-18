import React from 'react'
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { getFileTypeIcon } from '@baishou/ui'
import type { FileTreeNode } from './useWorkbenchFileTree'
import { workbenchTreeTwistieOffset } from './workbench-file-tree.util'
import { parentRelativePath } from './workbench-path.util'
import { InlineTreeNameRow, type InlineTreeEditState } from './WorkbenchFileExplorerInlineEdit'
import styles from './WorkbenchFileExplorer.module.css'

export interface WorkbenchFileExplorerTreeNodeProps {
  node: FileTreeNode
  depth: number
  selectedPaths: ReadonlySet<string>
  isExpanded: (path: string) => boolean
  getChildren: (path: string) => FileTreeNode[]
  onToggle: (path: string) => void
  onSelect: (relativePath: string, event: React.MouseEvent) => void
  onContextMenu: (event: React.MouseEvent, node: FileTreeNode) => void
  inlineEdit: InlineTreeEditState | null
  onCommitInline: (name: string) => void
  onCancelInline: () => void
  draggingPaths: string[]
  dropTargetDir: string | null
  onDragStart: (event: React.DragEvent, node: FileTreeNode) => void
  onDragEnd: () => void
  onDragOver: (event: React.DragEvent, node: FileTreeNode) => void
  onDrop: (event: React.DragEvent, node: FileTreeNode) => void
}

export const WorkbenchFileExplorerTreeNode: React.FC<WorkbenchFileExplorerTreeNodeProps> = ({
  node,
  depth,
  selectedPaths,
  isExpanded,
  getChildren,
  onToggle,
  onSelect,
  onContextMenu,
  inlineEdit,
  onCommitInline,
  onCancelInline,
  draggingPaths,
  dropTargetDir,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  const expanded = node.isDirectory && isExpanded(node.relativePath)
  const children = expanded ? getChildren(node.relativePath) : []
  const isSelected = selectedPaths.has(node.relativePath)
  const isRenaming = inlineEdit?.mode === 'rename' && inlineEdit.relativePath === node.relativePath
  const pendingCreate = inlineEdit?.mode === 'create' && inlineEdit.parentDir === node.relativePath
  const isDragging = draggingPaths.includes(node.relativePath)
  const isDropTarget = node.isDirectory && dropTargetDir === node.relativePath

  return (
    <>
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${isRenaming ? styles.rowEditing : ''} ${isDragging ? styles.rowDragging : ''} ${isDropTarget ? styles.rowDropTarget : ''}`}
        draggable={!isRenaming}
        onDragStart={(event) => onDragStart(event, node)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => onDragOver(event, node)}
        onDrop={(event) => onDrop(event, node)}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        {depth > 0 ? (
          <span className={styles.indentGuides} aria-hidden>
            {Array.from({ length: depth }, (_, index) => (
              <span key={index} className={styles.indentGuide} />
            ))}
          </span>
        ) : null}
        <span className={styles.twistie} style={{ marginLeft: workbenchTreeTwistieOffset(depth) }}>
          {node.isDirectory ? (
            <button
              type="button"
              className={styles.chevronBtn}
              onClick={() => onToggle(node.relativePath)}
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown size={16} strokeWidth={1.75} />
              ) : (
                <ChevronRight size={16} strokeWidth={1.75} />
              )}
            </button>
          ) : null}
        </span>
        {isRenaming ? (
          <InlineTreeNameRow
            depth={depth}
            isDirectory={node.isDirectory}
            initialName={inlineEdit.initialName}
            existingNames={getChildren(parentRelativePath(node.relativePath)).map(
              (child) => child.name
            )}
            ignoreName={node.name}
            onCommit={onCommitInline}
            onCancel={onCancelInline}
            embedded
          />
        ) : (
          <button
            type="button"
            className={styles.nameBtn}
            onClick={(event) => onSelect(node.relativePath, event)}
          >
            <span className={styles.rowIcon}>
              {node.isDirectory ? (
                expanded ? (
                  <FolderOpen size={16} strokeWidth={1.75} />
                ) : (
                  <Folder size={16} strokeWidth={1.75} />
                )
              ) : (
                getFileTypeIcon(node.name, 16)
              )}
            </span>
            <span className={styles.name}>{node.name}</span>
          </button>
        )}
      </div>
      {expanded ? (
        <>
          {children.map((child) => (
            <WorkbenchFileExplorerTreeNode
              key={child.relativePath}
              node={child}
              depth={depth + 1}
              selectedPaths={selectedPaths}
              isExpanded={isExpanded}
              getChildren={getChildren}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              inlineEdit={inlineEdit}
              onCommitInline={onCommitInline}
              onCancelInline={onCancelInline}
              draggingPaths={draggingPaths}
              dropTargetDir={dropTargetDir}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
          {pendingCreate ? (
            <InlineTreeNameRow
              depth={depth + 1}
              isDirectory={inlineEdit.kind === 'folder'}
              initialName={inlineEdit.initialName}
              existingNames={children.map((child) => child.name)}
              onCommit={onCommitInline}
              onCancel={onCancelInline}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}
