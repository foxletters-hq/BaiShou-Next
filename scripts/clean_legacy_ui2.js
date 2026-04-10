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
  'packages/ui/src/web/ChatAppBar/ChatAppBar.module.css', 
  'packages/ui/src/web/AgentSessionList/AgentSessionList.module.css',
  'apps/desktop/src/renderer/src/components/TitleBar.module.css', 
  // Add new files missed previously:
  'packages/ui/src/web/WebSearchSettingsView/WebSearchSettingsView.module.css',
];

function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Replace background surfaces
  content = content.replace(/background(-color)?:\s*var\(--color-surface[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'background: var(--bg-surface);');
  content = content.replace(/background(-color)?:\s*var\(--color-surface-variant[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'background: var(--bg-surface-normal);');
  content = content.replace(/background(-color)?:\s*var\(--color-surface-container[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'background: var(--bg-surface-normal);');
  content = content.replace(/background(-color)?:\s*var\(--color-surface-dark[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'background: var(--bg-surface);');
  
  // Replace hardcoded rgba(255, 255, 255, x) backgrounds
  content = content.replace(/background(-color)?:\s*rgba?\(\s*255\s*,\s*255\s*,\s*255\s*,\s*[\d.]+\s*\);/g, 'background: var(--bg-glass-surface);');
  
  // Replace missing text colors
  content = content.replace(/color:\s*var\(--color-on-surface[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'color: var(--text-primary);');
  content = content.replace(/color:\s*var\(--color-on-surface-variant[^)]*\)(?:,\s*(#[0-9a-fA-F]+|rgba?\([^)]+\)))?;/g, 'color: var(--text-secondary);');

  // Specific buttons / gradients removal
  if (filePath.includes('AssistantManagementView')) {
    content = content.replace(/background:\s*linear-gradient\([^)]+\)\s*!important?;?/g, '');
    content = content.replace(/background:\s*linear-gradient\([^)]+\);?/g, 'background-color: var(--color-primary);');
  }

  // Destroy legacy dark mode overrides entirely! (except when we need them, but mostly they override colors that break the new theming engine)
  content = content.replace(/\[data-theme="dark"\][^{]*\{[^}]*\}/g, '');
  content = content.replace(/:global\(body\[data-theme='dark'\]\)[^{]*\{[^}]*\}/g, '');

  fs.writeFileSync(fullPath, content, 'utf8');
}

filesToFix.forEach(processFile);
console.log('Second pass cleanup complete.');
