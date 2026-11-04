/**
 * 英文 UI 文案目录：本目录下按领域拆分的 JSON 片段在这里合并成一个 translation 命名空间。
 * 新增或删除片段时，四种语言的 index.ts 要同步登记（locales 一致性测试会检查）。
 */
import { mergeCatalogs } from '../merge-catalogs'
import agent from './agent.json'
import agentChat from './agent-chat.json'
import agentTools from './agent-tools.json'
import ai from './ai.json'
import appShell from './app-shell.json'
import common from './common.json'
import dataSync from './data-sync.json'
import diary from './diary.json'
import graph from './graph.json'
import knowledge from './knowledge.json'
import onboarding from './onboarding.json'
import settings from './settings.json'
import settingsAgent from './settings-agent.json'
import settingsAi from './settings-ai.json'
import settingsRag from './settings-rag.json'
import storage from './storage.json'
import summary from './summary.json'
import versionControl from './version-control.json'
import workbench from './workbench.json'

export default mergeCatalogs(
  agent,
  agentChat,
  agentTools,
  ai,
  appShell,
  common,
  dataSync,
  diary,
  graph,
  knowledge,
  onboarding,
  settings,
  settingsAgent,
  settingsAi,
  settingsRag,
  storage,
  summary,
  versionControl,
  workbench
)
