const fs = require('fs');

const data = require('./suspicious_chinese.json');
const files = Array.from(new Set(data.map(d => d.file.replace(/\\/g, '/'))))
    .filter(f => !f.includes('.test.') && !f.includes('__tests__') && !f.endsWith('.ts'));

const report = {};
files.forEach(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const targetLines = [];
    lines.forEach((line, index) => {
        if (/[\u4e00-\u9fa5]/.test(line) && !line.trim().startsWith('//') && !line.includes('console.') && !line.includes('t(')) {
            targetLines.push({ lineNum: index + 1, text: line.trim() });
        }
    });
    if (targetLines.length > 0) {
        report[f] = targetLines;
    }
});

fs.writeFileSync('i18n_todo.json', JSON.stringify(report, null, 2), 'utf8');
console.log('Generated i18n_todo.json with', Object.keys(report).length, 'files to fix.');
