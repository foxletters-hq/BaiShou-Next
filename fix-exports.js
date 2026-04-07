const fs = require('fs');
const path = require('path');

const baseDir = path.join(__dirname, 'packages/database/src');
const indexTsPath = path.join(baseDir, 'index.ts');

let indexContent = fs.readFileSync(indexTsPath, 'utf8');
const lines = indexContent.split('\n');

const newLines = [];

for (const line of lines) {
    const match = line.match(/export\s*\*\s*from\s*'([^']+)'/);
    if (!match) {
        newLines.push(line);
        continue;
    }
    
    const relPath = match[1];
    let filePath = path.join(baseDir, relPath + '.ts');
    if (!fs.existsSync(filePath)) {
        filePath = path.join(baseDir, relPath, 'index.ts');
    }
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        newLines.push(line);
        continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();
    
    // Match export const/class/function/type/interface Name
    const regex1 = /export\s+(?:const|class|function|type|interface|let|var)\s+([a-zA-Z0-9_]+)/g;
    let m;
    while ((m = regex1.exec(content)) !== null) {
        exports.add(m[1]);
    }
    
    // Match export { A, B as C }
    const regex2 = /export\s+{([^}]+)}/g;
    while ((m = regex2.exec(content)) !== null) {
        const parts = m[1].split(',');
        for (const p of parts) {
            const pTrim = p.trim();
            if (pTrim) {
                // handle "A as B" -> "B" or "A as B"
                const aliasMatch = pTrim.match(/\S+\s+as\s+(\S+)/);
                if (aliasMatch) {
                    exports.add(aliasMatch[1]); // Wait, if it's export { A as B }, B is the exported name. Actually, we must do export { A as B } ... but for simplicity we can just export * if there's complex stuff.
                } else {
                    exports.add(pTrim.split(/\s+/)[0]);
                }
            }
        }
    }

    if (exports.size > 0) {
        const exportsList = Array.from(exports).join(', ');
        newLines.push(`export { ${exportsList} } from '${relPath}';`);
    } else {
        newLines.push(line); // Fallback
    }
}

fs.writeFileSync(indexTsPath, newLines.join('\n'), 'utf8');
console.log('Fixed index.ts exports!');
