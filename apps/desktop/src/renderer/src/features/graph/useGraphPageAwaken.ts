import { useEffect, useRef, useState } from 'react'
import { validateGraphAwakenForm, type UserGender, type UserProfile } from '@baishou/shared'
import {
  loadDesktopGraphAwakenSelfName,
  saveDesktopGraphAwakenProfile
} from '../diary/utils/ensure-graph-self-name'
import {
  buildGraphSelfPersonAliases,
  findGraphSelfPersonHit,
  graphProfileFormFromAwaken
} from './graph-page-derive.util'
import { viewDepthFor } from './graph-page-view.util'
import type { GraphFocusDepth } from '@baishou/shared'

type AwakenDeps = {
  t: (key: string, defaultValue?: string) => string
  toast: { showSuccess: (message: string) => void; showError: (message: string) => void }
  setStatus: (status: string) => void
  setEdgeTypes: (types: string[]) => void
  setAddEdgeType: (type: string) => void
  refresh: () => Promise<void>
  selectedId: string | null
  selectedNode: any | null
  setSelectedNode: (node: any | null) => void
  setLocalView: (view: { nodes: any[]; edges: any[] } | null) => void
  focusDepth: GraphFocusDepth
}

export function useGraphPageAwaken(deps: AwakenDeps) {
  const [selfNameReady, setSelfNameReady] = useState<boolean | null>(null)
  const [awakenProfile, setAwakenProfile] = useState<UserProfile | null>(null)
  const [awakenBusy, setAwakenBusy] = useState(false)
  const [profileForm, setProfileForm] = useState<{
    nickname: string
    birthday: string
    gender: UserGender | ''
  }>({ nickname: '', birthday: '', gender: '' })
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileErrors, setProfileErrors] = useState<{
    nickname?: boolean
    birthday?: boolean
    gender?: boolean
  }>({})
  const [profileSectionOpen, setProfileSectionOpen] = useState(false)
  const depsRef = useRef(deps)
  depsRef.current = deps

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const state = await loadDesktopGraphAwakenSelfName()
        if (cancelled) return
        setAwakenProfile(state.profile)
        setSelfNameReady(state.ready)
        if (!state.ready) return
        void window.api.graph.meta().then((m) => {
          if (cancelled) return
          depsRef.current.setEdgeTypes(m.edgeTypes || [])
          if (m.edgeTypes?.[0]) depsRef.current.setAddEdgeType(m.edgeTypes[0])
        })
      } catch (e) {
        if (cancelled) return
        setSelfNameReady(false)
        depsRef.current.setStatus(String((e as Error)?.message || e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!awakenProfile) return
    setProfileForm(graphProfileFormFromAwaken(awakenProfile))
  }, [awakenProfile])

  const completeAwaken = async (fields: {
    nickname: string
    birthday: string
    gender: UserGender
  }) => {
    setAwakenBusy(true)
    try {
      await saveDesktopGraphAwakenProfile(fields)
      setSelfNameReady(true)
      setAwakenProfile((prev) => ({
        ...(prev || ({} as UserProfile)),
        nickname: fields.nickname,
        birthday: fields.birthday,
        gender: fields.gender
      }))
      deps.setStatus('')
      void window.api.graph.meta().then((m) => {
        deps.setEdgeTypes(m.edgeTypes || [])
        if (m.edgeTypes?.[0]) deps.setAddEdgeType(m.edgeTypes[0])
      })
      await deps.refresh()
    } catch (e: any) {
      deps.setStatus(e?.message || String(e))
    } finally {
      setAwakenBusy(false)
    }
  }

  const syncSelfPersonNode = async (oldName: string, newName: string) => {
    const prev = oldName.trim()
    const next = newName.trim()
    if (!prev || !next || prev === next) return false
    const hits = await window.api.graph.search({
      query: prev,
      nodeTypes: ['person'],
      limit: 20
    })
    const match = findGraphSelfPersonHit(hits, prev)
    if (!match) return false
    const aliases = buildGraphSelfPersonAliases(match.aliases, prev, next)
    await window.api.graph.upsertNode({
      id: (match as { id: string }).id,
      name: next,
      nodeType: 'person',
      aliases,
      summary: (match as { summary?: string }).summary || undefined
    })
    return true
  }

  const saveProfileFromSettings = async () => {
    const nextErrors = validateGraphAwakenForm(profileForm)
    setProfileErrors({
      nickname: !!nextErrors.nickname,
      birthday: !!nextErrors.birthday,
      gender: !!nextErrors.gender
    })
    if (Object.keys(nextErrors).length > 0) return
    setProfileBusy(true)
    try {
      const oldName = awakenProfile?.nickname?.trim() || ''
      const fields = {
        nickname: profileForm.nickname.trim(),
        birthday: profileForm.birthday.trim(),
        gender: profileForm.gender as UserGender
      }
      await saveDesktopGraphAwakenProfile(fields)
      const synced = await syncSelfPersonNode(oldName, fields.nickname)
      setAwakenProfile((prev) => ({
        ...(prev || ({} as UserProfile)),
        nickname: fields.nickname,
        birthday: fields.birthday,
        gender: fields.gender
      }))
      setSelfNameReady(true)
      await deps.refresh()
      if (deps.selectedId) {
        const view = await window.api.graph.getView({
          centerNodeId: deps.selectedId,
          depth: viewDepthFor(deps.focusDepth)
        })
        deps.setLocalView(view)
        if (deps.selectedNode?.id === deps.selectedId) {
          const node = await window.api.graph.getNode(deps.selectedId)
          deps.setSelectedNode(node)
        }
      }
      deps.toast.showSuccess(
        synced
          ? deps.t('graph.profile_saved_synced', '已保存，并同步更新图谱中的自称节点')
          : deps.t('graph.profile_saved', '已保存身份资料')
      )
    } catch (e: any) {
      const message = e?.message || String(e)
      deps.setStatus(message)
      deps.toast.showError(message)
    } finally {
      setProfileBusy(false)
    }
  }

  return {
    selfNameReady,
    setSelfNameReady,
    awakenProfile,
    awakenBusy,
    profileForm,
    setProfileForm,
    profileBusy,
    profileErrors,
    profileSectionOpen,
    setProfileSectionOpen,
    completeAwaken,
    saveProfileFromSettings
  }
}
