const fs = require('fs');

function injectI18n(filePath, replacements) {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Apply specific replacements
    for (const r of replacements) {
        if (content.includes(r.search)) {
            content = content.replace(r.search, r.replace);
            modified = true;
        } else {
            console.log(`[Warning] Could not find in ${filePath}:\n${r.search}`);
        }
    }

    if (modified) {
        // Ensure useTranslation is imported
        if (!content.includes("useTranslation")) {
            const importStatement = "import { useTranslation } from 'react-i18next';\n";
            // Insert after the last import, or at top
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('import ')) {
                    lastImportIndex = i;
                }
            }
            if (lastImportIndex !== -1) {
                lines.splice(lastImportIndex + 1, 0, importStatement);
            } else {
                lines.unshift(importStatement);
            }
            content = lines.join('\n');
        }

        // Ensure const { t } = useTranslation(); is inside the component
        // 查找类似 export const Component = ... 或 function Component()
        // 这个有点风险，但对于简单的组件可用
        if (!content.includes("const { t } = useTranslation();")) {
            // Find component definition
            const compDefRegex = /(export +(const|function) +[A-Z][a-zA-Z0-9_]* *[=]? *\([^)]*\) *(?:=>)? *{)/;
            const match = content.match(compDefRegex);
            if (match) {
                const insertPos = match.index + match[0].length;
                content = content.slice(0, insertPos) + "\n  const { t } = useTranslation();" + content.slice(insertPos);
            } else {
                // Try default export component
                const defaultDefRegex = /(export +default +(function|const) +[A-Z][a-zA-Z0-9_]* *\([^)]*\) *(?:=>)? *{)/;
                const match2 = content.match(defaultDefRegex);
                if (match2) {
                    const insertPos = match2.index + match2[0].length;
                    content = content.slice(0, insertPos) + "\n  const { t } = useTranslation();" + content.slice(insertPos);
                } else {
                   console.log(`[Warning] Could not find component definition to inject 't' in ${filePath}`);
                }
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[Success] Updated ${filePath}`);
    }
}

// Check arguments
const inputJSON = process.argv[2];
if (inputJSON && fs.existsSync(inputJSON)) {
    const data = JSON.parse(fs.readFileSync(inputJSON, 'utf8'));
    for (const [file, info] of Object.entries(data)) {
        console.log(`Processing ${file}...`);
        injectI18n(file, info.replacements);
    }
} else {
    module.exports = injectI18n;
}
