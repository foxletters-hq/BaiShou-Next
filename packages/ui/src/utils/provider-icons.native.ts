/**
 * 供应商品牌图标（Metro 静态资源模块，供 RN ProviderBrandIcon 使用）
 */

import { Asset } from 'expo-asset'
import openaiIcon from '../assets/ai_provider_icon/openai.svg'
import geminiColorIcon from '../assets/ai_provider_icon/gemini-color.svg'
import geminiMonoIcon from '../assets/ai_provider_icon/gemini.svg'
import anthropicIcon from '../assets/ai_provider_icon/anthropic.svg'
import deepseekColorIcon from '../assets/ai_provider_icon/deepseek-color.svg'
import deepseekMonoIcon from '../assets/ai_provider_icon/deepseek.svg'
import kimiColorIcon from '../assets/ai_provider_icon/kimi.svg'
import kimiMonoIcon from '../assets/ai_provider_icon/kimi.svg'
import ollamaIcon from '../assets/ai_provider_icon/ollama.svg'
import dashscopeColorIcon from '../assets/ai_provider_icon/dashscope-color.svg'
import dashscopeMonoIcon from '../assets/ai_provider_icon/dashscope.svg'
import siliconflowColorIcon from '../assets/ai_provider_icon/siliconflow-color.svg'
import siliconflowMonoIcon from '../assets/ai_provider_icon/siliconflow.svg'
import openrouterIcon from '../assets/ai_provider_icon/openrouter.svg'
import doubaoColorIcon from '../assets/ai_provider_icon/doubao-color.svg'
import doubaoMonoIcon from '../assets/ai_provider_icon/doubao.svg'
import grokIcon from '../assets/ai_provider_icon/grok.svg'
import mistralColorIcon from '../assets/ai_provider_icon/mistral-color.svg'
import mistralMonoIcon from '../assets/ai_provider_icon/mistral.svg'
import lmstudioIcon from '../assets/ai_provider_icon/lmstudio.svg'
import xiaomimimoIcon from '../assets/ai_provider_icon/xiaomimimo.svg'
import zhipuColorIcon from '../assets/ai_provider_icon/zhipu-color.svg'
import stepfunColorIcon from '../assets/ai_provider_icon/stepfun-color.svg'
import volcengineColorIcon from '../assets/ai_provider_icon/volcengine-color.svg'
import hunyuanColorIcon from '../assets/ai_provider_icon/hunyuan-color.svg'
import vertexaiColorIcon from '../assets/ai_provider_icon/vertexai-color.svg'
import vercelIcon from '../assets/ai_provider_icon/vercel.svg'
import minimaxColorIcon from '../assets/ai_provider_icon/minimax-color.svg'

export type ProviderIconModule = number

interface IconPair {
  light: ProviderIconModule
  dark: ProviderIconModule
}

const PROVIDER_ICONS: Record<string, IconPair> = {
  openai: { light: openaiIcon, dark: openaiIcon },
  gemini: { light: geminiColorIcon, dark: geminiMonoIcon },
  anthropic: { light: anthropicIcon, dark: anthropicIcon },
  deepseek: { light: deepseekColorIcon, dark: deepseekMonoIcon },
  kimi: { light: kimiColorIcon, dark: kimiMonoIcon },
  ollama: { light: ollamaIcon, dark: ollamaIcon },
  siliconflow: { light: siliconflowColorIcon, dark: siliconflowMonoIcon },
  openrouter: { light: openrouterIcon, dark: openrouterIcon },
  dashscope: { light: dashscopeColorIcon, dark: dashscopeMonoIcon },
  doubao: { light: doubaoColorIcon, dark: doubaoMonoIcon },
  grok: { light: grokIcon, dark: grokIcon },
  mistral: { light: mistralColorIcon, dark: mistralMonoIcon },
  lmstudio: { light: lmstudioIcon, dark: lmstudioIcon },
  xiaomimimo: { light: xiaomimimoIcon, dark: xiaomimimoIcon },
  zhipu: { light: zhipuColorIcon, dark: zhipuColorIcon },
  stepfun: { light: stepfunColorIcon, dark: stepfunColorIcon },
  volcengine: { light: volcengineColorIcon, dark: volcengineColorIcon },
  hunyuan: { light: hunyuanColorIcon, dark: hunyuanColorIcon },
  vertexai: { light: vertexaiColorIcon, dark: vertexaiColorIcon },
  vercel: { light: vercelIcon, dark: vercelIcon },
  minimax: { light: minimaxColorIcon, dark: minimaxColorIcon }
}

export function getProviderIconModule(
  providerId: string,
  isDark: boolean
): ProviderIconModule | undefined {
  const pair = PROVIDER_ICONS[providerId]
  if (!pair) return undefined
  return isDark ? pair.dark : pair.light
}

export function hasProviderIcon(providerId: string): boolean {
  return providerId in PROVIDER_ICONS
}

const resolvedIconUriCache = new Map<ProviderIconModule, string>()
const resolvedIconXmlCache = new Map<ProviderIconModule, string>()
const pendingIconUriResolves = new Map<ProviderIconModule, Promise<string | null>>()
const pendingIconXmlResolves = new Map<ProviderIconModule, Promise<string | null>>()

export function getCachedProviderIconUri(iconModule: ProviderIconModule): string | undefined {
  return resolvedIconUriCache.get(iconModule)
}

export function getCachedProviderIconXml(iconModule: ProviderIconModule): string | undefined {
  return resolvedIconXmlCache.get(iconModule)
}

/** 解析并缓存供应商 SVG 模块对应的本地 URI，避免 Modal 反复挂载时重复 downloadAsync */
export async function resolveProviderIconUri(
  iconModule: ProviderIconModule
): Promise<string | null> {
  const cached = resolvedIconUriCache.get(iconModule)
  if (cached) return cached

  const pending = pendingIconUriResolves.get(iconModule)
  if (pending) return pending

  const task = (async () => {
    try {
      const asset = Asset.fromModule(iconModule)
      if (!asset.localUri) {
        await asset.downloadAsync()
      }
      const uri = asset.localUri ?? asset.uri
      if (uri) resolvedIconUriCache.set(iconModule, uri)
      return uri ?? null
    } catch {
      return null
    } finally {
      pendingIconUriResolves.delete(iconModule)
    }
  })()

  pendingIconUriResolves.set(iconModule, task)
  return task
}

/** 解析并缓存 SVG 正文，供 SvgXml 同步渲染，避免 SvgUri 每次挂载重新 fetch */
export async function resolveProviderIconXml(
  iconModule: ProviderIconModule
): Promise<string | null> {
  const cachedXml = resolvedIconXmlCache.get(iconModule)
  if (cachedXml) return cachedXml

  const pending = pendingIconXmlResolves.get(iconModule)
  if (pending) return pending

  const task = (async () => {
    try {
      const uri = await resolveProviderIconUri(iconModule)
      if (!uri) return null
      const response = await fetch(uri)
      const xml = await response.text()
      if (xml) resolvedIconXmlCache.set(iconModule, xml)
      return xml || null
    } catch {
      return null
    } finally {
      pendingIconXmlResolves.delete(iconModule)
    }
  })()

  pendingIconXmlResolves.set(iconModule, task)
  return task
}

/** 应用启动时预加载全部品牌图标，进入供应商管理时可立即显示 */
export function preloadAllProviderIcons(): void {
  const modules = new Set<ProviderIconModule>()
  for (const pair of Object.values(PROVIDER_ICONS)) {
    modules.add(pair.light)
    modules.add(pair.dark)
  }
  for (const iconModule of modules) {
    void resolveProviderIconXml(iconModule)
  }
}
