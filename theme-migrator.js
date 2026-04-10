const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('dist')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.css')) results.push(file);
    }
  });
  return results;
}

const files = [
  ...walk(path.join(__dirname, 'apps/desktop/src')),
  ...walk(path.join(__dirname, 'packages/ui/src'))
];

let replacedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Background replacements
  content = content.replace(/(background(?:-color)?\s*:\s*)(#fff|#ffffff|white)\b/ig, '$1var(--bg-surface)');
  content = content.replace(/(background(?:-color)?\s*:\s*)(#f6f7f8|#f7f8fa|#f8f9fa|#f2f3f5)/ig, '$1var(--bg-app)');
  
  // Text color replacements
  content = content.replace(/(color\s*:\s*)(#000|#000000|black)\b/ig, '$1var(--text-primary)');
  content = content.replace(/(color\s*:\s*)(#333|#333333|#222|#1a1a1a)\b/ig, '$1var(--text-primary)');
  content = content.replace(/(color\s*:\s*)(#555|#666|#777|#475569|#4A5568|#64748B)\b/ig, '$1var(--text-secondary)');
  content = content.replace(/(color\s*:\s*)(#999|#888|#A0AEC0)\b/ig, '$1var(--text-tertiary)');
  
  // Border replacements
  content = content.replace(/(border(?:-top|-bottom|-left|-right)?\s*:\s*.*?)(#e8e8e8|#eee|#eeeeee|#f0f0f0|#e2e8f0|#edf2f7)/ig, '$1var(--border-subtle)');
  
  // Custom Material ones seen in TitleBar
  content = content.replace(/var\(--color-surface-container-low\)/g, 'var(--bg-app)');
  content = content.replace(/var\(--color-surface\)/g, 'var(--bg-surface)');
  content = content.replace(/var\(--color-on-surface-variant\)/g, 'var(--text-secondary)');
  content = content.replace(/var\(--color-on-surface\)/g, 'var(--text-primary)');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    replacedCount++;
    console.log(`Updated: ${file}`);
  }
});

console.log(`Total files updated: ${replacedCount}`);
