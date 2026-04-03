const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== '__tests__') {
         walkDir(dirPath, callback);
      }
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
         callback(dirPath);
      }
    }
  });
}

const searchPaths = [
  'd:/Projects/BaiShou-Next/packages/ui/src', 
  'd:/Projects/BaiShou-Next/apps/desktop/src'
];

let suspicious = [];

searchPaths.forEach(searchPath => {
  if (fs.existsSync(searchPath)) {
    walkDir(searchPath, function(file) {
      const code = fs.readFileSync(file, 'utf-8');
      const lines = code.split('\n');
      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) return;
        
        // If there's Chinese in it:
        if (/[\u4e00-\u9fa5]/.test(line)) {
           // check if NOT wrapped in t('') or console.log
           if (!line.includes('t(') && !line.includes('console.')) {
             suspicious.push({ file: file, line: index + 1, content: line.trim() });
           }
        }
      });
    });
  }
});

fs.writeFileSync('suspicious_chinese.json', JSON.stringify(suspicious, null, 2), 'utf-8');
console.log('Found', suspicious.length, 'suspicious lines.');
