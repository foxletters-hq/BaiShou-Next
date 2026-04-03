const fs = require('fs');

let c;

c = fs.readFileSync('packages/ui/src/web/AIGlobalModelsView/index.tsx', 'utf8');
c = c.replace(/`【高危警告: 向量塌陷风险】\\n您正在尝试切换系统的脑部索引神经元，从 \$\{config\.defaultEmbeddingModel\} 换为 \$\{val\}。\\n这会导致您之前记录的所有上下文、日记将永久无法被新的神经网络读取，需要进行漫长的全盘向量重算！\\n\\n点击【确认】以承受风险并变更。`/, "`t('models.embedding_warning', '【高危险警告: 向量库脱节】\\n您尝试将系统核心嵌入模型从 {{old}} 切换到 {{new}}。旧有记忆将可能作废，需要进入重新推导演算程序。\\n点击确认应用', {old: config.defaultEmbeddingModel, new: val})`");
fs.writeFileSync('packages/ui/src/web/AIGlobalModelsView/index.tsx', c);
console.log('Fixed AIGlobal');

c = fs.readFileSync('packages/ui/src/web/AgentToolsView/index.tsx', 'utf8');
c = c.replace(/`警告：具有深层系统风险\\n\\n您正在赋予 AI 具有操作系统破坏性乃至隐私外泄风险的 \$\{tool\.name\}。\\n如果此模型或插件被恶意劫持（例如 Prompt Injection），可能会产生灾难性后果！！！\\n\\n是否确认启用？`/, "`t('agent.tools.dangerous_warning', '【安全告警】\\n正尝试开启具有高危权限的操作授权 ({{toolName}})。如遇恶意挟持可能有数据泄露或系统篡改风险。\\n确认坚持？', { toolName: tool.name })`");
fs.writeFileSync('packages/ui/src/web/AgentToolsView/index.tsx', c);
console.log('Fixed AgentTools');

c = fs.readFileSync('packages/ui/src/web/ChatBubble/ToolCallSkeleton.tsx', 'utf8');
c = c.replace('<span className={styles.label}>AI Agent 正在使用工具</span>', "<span className={styles.label}>{t('agent.chat.using_tool', 'AI 核心协议激活并流转中')}</span>");
if(!c.includes('useTranslation')) {
    c = "import { useTranslation } from 'react-i18next';\n" + c;
    c = c.replace('export const ToolCallSkeleton: React.FC<ToolCallSkeletonProps> = ({ toolName }) => {', 'export const ToolCallSkeleton: React.FC<ToolCallSkeletonProps> = ({ toolName }) => {\n  const { t } = useTranslation();');
}
fs.writeFileSync('packages/ui/src/web/ChatBubble/ToolCallSkeleton.tsx', c);
console.log('Fixed ToolCall');

c = fs.readFileSync('packages/ui/src/web/CloudSyncPanel/index.tsx', 'utf8');
c = c.replace(/`危险操作！您确定要永久清除本地且解除绑定该同步服务吗？\\n此操作不可逆！\\n\\n请输入 "DELETE" 以确认：`/, "`t('cloud.delete_confirm', '【销毁提示】您确认解除绑定服务器配置并清理密钥残留吗？输入 \\'DELETE\\' 以确认。')`");
fs.writeFileSync('packages/ui/src/web/CloudSyncPanel/index.tsx', c);
console.log('Fixed CloudSync');
