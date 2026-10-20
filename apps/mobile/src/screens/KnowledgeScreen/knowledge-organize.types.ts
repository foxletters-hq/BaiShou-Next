/** 整理阶段与进度相关的公共类型，供进度计算、详情列表和横幅共同使用。 */

export type KnowledgeOrganizePhaseId = 'extract' | 'embed' | 'graph' | 'graphNodes'
export type KnowledgeOrganizePhaseStatus = 'pending' | 'running' | 'done' | 'failed'

export type KnowledgeOrganizePhaseRow = {
  id: KnowledgeOrganizePhaseId
  status: KnowledgeOrganizePhaseStatus
  completed: number
  total: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeProcessLine = {
  sourceId: string
  title: string
  phase: KnowledgeOrganizePhaseId
  status: KnowledgeOrganizePhaseStatus
  detail?: string
  completed?: number
  total?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeDetailSource = {
  sourceId: string
  title: string
  error?: string
  hint?: string
  phases: KnowledgeOrganizePhaseRow[]
}

export type KnowledgeOrganizeJobItem = {
  sourceId: string
  title: string
  stage?: string
  status: string
  lastError?: string | null
  windowsDone?: number
  windowsTotal?: number
  nodesDone?: number
  nodesTotal?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeProgress = {
  page: number
  total: number
  phase?: string
  windowsDone?: number
  windowsTotal?: number
  nodesDone?: number
  nodesTotal?: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

export type KnowledgeOrganizeTaskAction = 'restart' | 'cancel'
