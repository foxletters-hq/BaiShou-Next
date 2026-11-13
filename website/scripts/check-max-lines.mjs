/**
 * 源码与样式文件行数检查：统一保证所有 .ts / .tsx / .js / .mjs / .css 不超过 300 有效行。
 * 用法：node scripts/check-max-lines.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const MAX_LINES = 300;
const TARGET_DIRS = ['src', 'scripts', 'tests'];
const IGNORE_DIRS = new Set(['content', 'generated', 'node_modules', 'dist', 'dist-ssr']);
const TARGET_EXTS = new Set(['.css', '.ts', '.tsx', '.js', '.mjs']);

/** 统计有效行：去掉空行与纯注释行 */
function countEffectiveLines(text) {
  let inBlock = false;
  let count = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (inBlock) {
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlock = true;
      continue;
    }
    if (line.startsWith('//')) continue;
    count += 1;
  }
  return count;
}

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (TARGET_EXTS.has(extname(full))) files.push(full);
  }
  return files;
}

const offenders = TARGET_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
  .map((file) => ({
    file: relative(ROOT, file),
    lines: countEffectiveLines(readFileSync(file, 'utf8')),
  }))
  .filter((item) => item.lines > MAX_LINES);

if (offenders.length > 0) {
  console.error(`以下文件超过 ${MAX_LINES} 行，请拆分：`);
  for (const { file, lines } of offenders) console.error(`  ${file}: ${lines} 行`);
  process.exit(1);
}
console.log(`文件行数检查通过（上限 ${MAX_LINES} 行）。`);
