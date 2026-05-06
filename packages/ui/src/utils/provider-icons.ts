/**
 * 供应商图标管理工具
 * 支持根据深色/浅色模式自动切换图标
 */

// 彩色图标（品牌色固定）
import openaiIcon from '../assets/ai_provider_icon/openai.svg';
import geminiColorIcon from '../assets/ai_provider_icon/gemini-color.svg';
import geminiMonoIcon from '../assets/ai_provider_icon/gemini.svg';
import anthropicIcon from '../assets/ai_provider_icon/anthropic.svg';
import deepseekColorIcon from '../assets/ai_provider_icon/deepseek-color.svg';
import deepseekMonoIcon from '../assets/ai_provider_icon/deepseek.svg';
import kimiColorIcon from '../assets/ai_provider_icon/kimi-color.svg';
import kimiMonoIcon from '../assets/ai_provider_icon/kimi.svg';
import ollamaIcon from '../assets/ai_provider_icon/ollama.svg';
import dashscopeColorIcon from '../assets/ai_provider_icon/dashscope-color.svg';
import dashscopeMonoIcon from '../assets/ai_provider_icon/dashscope.svg';
import siliconflowColorIcon from '../assets/ai_provider_icon/siliconflow-color.svg';
import siliconflowMonoIcon from '../assets/ai_provider_icon/siliconflow.svg';
import openrouterIcon from '../assets/ai_provider_icon/openrouter.svg';
import doubaoColorIcon from '../assets/ai_provider_icon/doubao-color.svg';
import doubaoMonoIcon from '../assets/ai_provider_icon/doubao.svg';
import grokIcon from '../assets/ai_provider_icon/grok.svg';
import mistralColorIcon from '../assets/ai_provider_icon/mistral-color.svg';
import mistralMonoIcon from '../assets/ai_provider_icon/mistral.svg';
import lmstudioIcon from '../assets/ai_provider_icon/lmstudio.svg';

// 未来供应商图标
import xiaomimimoIcon from '../assets/ai_provider_icon/xiaomimimo.svg';
import zhipuColorIcon from '../assets/ai_provider_icon/zhipu-color.svg';
import stepfunColorIcon from '../assets/ai_provider_icon/stepfun-color.svg';
import volcengineColorIcon from '../assets/ai_provider_icon/volcengine-color.svg';
import hunyuanColorIcon from '../assets/ai_provider_icon/hunyuan-color.svg';
import vertexaiColorIcon from '../assets/ai_provider_icon/vertexai-color.svg';
import vercelIcon from '../assets/ai_provider_icon/vercel.svg';
import minimaxColorIcon from '../assets/ai_provider_icon/minimax-color.svg';

interface IconPair {
  light: string;
  dark: string;
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
  minimax: { light: minimaxColorIcon, dark: minimaxColorIcon },
};

export function getProviderIcon(providerId: string, isDark: boolean): string | undefined {
  const pair = PROVIDER_ICONS[providerId];
  if (!pair) return undefined;
  return isDark ? pair.dark : pair.light;
}

export function getProviderIconIds(): string[] {
  return Object.keys(PROVIDER_ICONS);
}
