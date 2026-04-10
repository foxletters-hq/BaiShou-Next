const fs = require('fs');
const path = require('path');

const filesToFix = [
  'packages/ui/src/web/LanSyncCard/LanSyncCard.module.css',
  'packages/ui/src/web/CloudSyncPanel/CloudSyncPanel.module.css',
  'packages/ui/src/web/RagMemoryView/RagMemoryView.module.css',
  'apps/desktop/src/renderer/src/features/diary/DiaryPage.css',
  'apps/desktop/src/renderer/src/features/settings/SettingsPage.css',
  'packages/ui/src/web/AIModelServicesView/AIModelServicesView.module.css',
  'packages/ui/src/web/AssistantManagementView/AssistantManagementView.module.css',
  'packages/ui/src/web/AgentToolsView/AgentToolsView.module.css',
  'packages/ui/src/web/AppearanceSettingsCard/AppearanceSettingsCard.css',
  'packages/ui/src/web/ChatAppBar/ChatAppBar.module.css', // 顶部导航栏 / 切换空间
  'packages/ui/src/web/AgentSessionList/AgentSessionList.module.css',
  'apps/desktop/src/renderer/src/components/TitleBar.module.css', // another titlebar
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace background surfaces
  content = content.replace(/background(-color)?:\s*var\(--color-surface[^)]*\)(?:,\s*#[0-9a-fA-F]+)?;/g, 'background: var(--bg-surface);');
  content = content.replace(/background(-color)?:\s*var\(--color-surface-variant[^)]*\)(?:,\s*#[0-9a-fA-F]+)?;/g, 'background: var(--bg-surface-normal);');
  content = content.replace(/background(-color)?:\s*var\(--color-surface-container[^)]*\)(?:,\s*#[0-9a-fA-F]+)?;/g, 'background: var(--bg-surface-normal);');
  
  // Replace missing text colors
  content = content.replace(/color:\s*var\(--color-on-surface[^)]*\)(?:,\s*#[0-9a-fA-F]+)?;/g, 'color: var(--text-primary);');
  content = content.replace(/color:\s*var\(--color-on-surface-variant[^)]*\)(?:,\s*#[0-9a-fA-F]+)?;/g, 'color: var(--text-secondary);');

  // Specific buttons / gradients removal
  if (filePath.includes('AssistantManagementView')) {
    content = content.replace(/background:\s*linear-gradient\([^)]+\)\s*!important?;?/g, '');
    content = content.replace(/background:\s*linear-gradient\([^)]+\);?/g, 'background-color: var(--color-primary);');
  }

  // Fixing DiaryPage / RagMemoryView Headers
  if (filePath.includes('DiaryPage.css')) {
    content = content.replace(/background-color:\s*rgba\(255,\s*255,\s*255,\s*0\.8\);/g, 'background-color: var(--bg-glass-surface);');
  }
  
  if (filePath.includes('RagMemoryView.module.css')) {
    content = content.replace(/\/\* === 1\. Header === \*\//, '/* === 1. Header === */');
    content = content.replace(/\.headerRow \{([\s\S]*?)\}/, `.headerRow {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  min-height: 56px;\n  padding: 12px 32px;\n  background-color: var(--bg-glass-surface);\n  backdrop-filter: var(--blur-overlay);\n  -webkit-backdrop-filter: var(--blur-overlay);\n  border-bottom: 1px solid var(--border-subtle);\n  position: sticky;\n  top: 0;\n  z-index: 10;\n}`);
  }

  // Destroy legacy dark mode overrides
  content = content.replace(/:global\(body\[data-theme='dark'\]\)[^{]*\{[\s\S]*?\n\}/g, '');
  content = content.replace(/\[data-theme="dark"\][^{]*\{[\s\S]*?\n\}/g, '');

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Processed: ${filePath}`);
}

filesToFix.forEach(processFile);
console.log('Cleanup complete.');
