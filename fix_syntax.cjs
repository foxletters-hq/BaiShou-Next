const glob = require('glob');
const fs = require('fs');

const files = glob.sync('packages/ui/src/**/*.{tsx,ts}').concat(glob.sync('apps/desktop/src/**/*.{tsx,ts}'));
let c = 0;

files.forEach(f => {
  let txt = fs.readFileSync(f, 'utf8');
  if (txt.includes('\\n  const { t } = useTranslation();')) {
    txt = txt.replace('\\n  const { t } = useTranslation();', '');

    // inject it in the correct place: after '=> {'
    let regex = /(?:export\s+)?(?:default\s+)?(?:const|function)\s+[A-Z][A-Za-z0-9_]*(?::\s*React\.[A-Za-z0-9_]+(?:<[^>]+>)?\s*)?\s*=\s*(?:\([^)]*\))?\s*(?:=>\s*\{|\{)/s;

    if (f.includes('OnboardingScreen.tsx')) {
        // Special case because the string was inside an array inside the component
        regex = /(?:export\s+)?(?:default\s+)?(?:const|function)\s+OnboardingScreen.*?(?:=>\s*\{)/s;
    } else if (f.includes('SettingsPage.tsx')) {
        regex = /(?:export\s+)?(?:default\s+)?(?:const|function)\s+SettingsPage.*?(?:=>\s*\{)/s;
    } else if (f.includes('AssistantMatrixCard')) {
        regex = /export const AssistantMatrixCard[^{]*\{/s;
    } else if (f.includes('LanSyncCard')) {
        regex = /export const LanSyncCard[^{]*\{/s;
    } else if (f.includes('AIModelServicesView')) {
        regex = /export const AIModelServicesView[^{]*\{/s;
    } else if (f.includes('AgentToolsView')) {
        regex = /export const AgentToolsView[^{]*\{/s; 
    }

    let m = txt.match(regex);
    if (m) {
      let idx = m.index + m[0].length;
      txt = txt.slice(0, idx) + '\n  const { t } = useTranslation();' + txt.slice(idx);
      fs.writeFileSync(f, txt);
      c++;
      console.log('Fixed', f);
    } else {
      // fallback if regex doesn't match
      let altMatch = txt.match(/=>\s*\{/);
      if (altMatch) {
         let idx = altMatch.index + altMatch[0].length;
         txt = txt.slice(0, idx) + '\n  const { t } = useTranslation();' + txt.slice(idx);
         fs.writeFileSync(f, txt);
         c++;
         console.log('Fixed bypass', f);
      } else {
         fs.writeFileSync(f, txt);
         console.log('Removed but could not reinject', f);
      }
    }
  }
});
console.log('Total fixed', c);
