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
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
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
  content = content.replace(/(background(?:Color)?\s*:\s*['"])(?:#fff|#ffffff|white)(['"])/ig, '$1var(--bg-surface)$2');
  content = content.replace(/(background(?:Color)?\s*:\s*['"])(?:#f6f7f8|#f7f8fa|#f8f9fa|#f2f3f5)(['"])/ig, '$1var(--bg-app)$2');
  
  // Text color replacements
  content = content.replace(/(color\s*:\s*['"])(?:#000|#000000|black)(['"])/ig, '$1var(--text-primary)$2');
  content = content.replace(/(color\s*:\s*['"])(?:#333|#333333|#222|#1a1a1a)(['"])/ig, '$1var(--text-primary)$2');
  content = content.replace(/(color\s*:\s*['"])(?:#555|#666|#777|#475569|#4A5568|#64748B)(['"])/ig, '$1var(--text-secondary)$2');
  content = content.replace(/(color\s*:\s*['"])(?:#999|#888|#A0AEC0)(['"])/ig, '$1var(--text-tertiary)$2');

  // Fix known MainLayout missing variable in CSS and inline if any
  content = content.replace(/var\(--bg-background/g, 'var(--bg-app');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    replacedCount++;
    console.log(`Updated TSX: ${file}`);
  }
});

console.log(`Total TSX files updated: ${replacedCount}`);
