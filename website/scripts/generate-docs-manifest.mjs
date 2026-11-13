/**
 * 构建期/开发前文档与远端快照预生成脚本：
 * 1. 扫描 src/content/docs/** 下全部 96 篇多语言 Markdown，通过 unified + remark/rehype 编译为 HTML 并提取标题目录树；
 * 2. 拉取构建期最新的安装包版本号与 GitHub 贡献者列表（带超时与兜底），写入 src/generated/。
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import GithubSlugger from 'github-slugger';
import { toString as hastToString } from 'hast-util-to-string';
import { visit } from 'unist-util-visit';

const ROOT = process.cwd();
const CONTENT_ROOT = join(ROOT, 'src', 'content', 'docs');
const GENERATED_DIR = join(ROOT, 'src', 'generated');
const ASIDE_TYPES = new Set(['note', 'tip', 'caution', 'danger']);

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const yamlBlock = match[1];
  const content = match[2];
  const data = {};
  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, content };
}

function remarkAsidesPlugin() {
  return (tree) => {
    visit(tree, (node, index, parent) => {
      if (node.type !== 'containerDirective') return;
      if (!ASIDE_TYPES.has(node.name)) return;
      if (parent == null || typeof index !== 'number') return;

      let label = '';
      if (node.children?.[0]?.data?.directiveLabel) {
        const labelNode = node.children.shift();
        label = (labelNode?.children || []).map((c) => c.value || '').join('');
      }
      if (!label && typeof node.attributes?.title === 'string') {
        label = node.attributes.title;
      }

      const data = node.data || (node.data = {});
      data.hName = 'aside';
      data.hProperties = { class: `docs-aside docs-aside--${node.name}` };

      if (label) {
        node.children.unshift({
          type: 'paragraph',
          data: {
            hName: 'p',
            hProperties: { class: 'docs-aside__title' },
          },
          children: [{ type: 'text', value: label }],
        });
      }
    });
  };
}

function rehypeWrapTablesPlugin() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table') return;
      if (parent == null || typeof index !== 'number') return;
      if (parent.type === 'element' && parent.tagName === 'div') {
        const cls = parent.properties?.className;
        const list = Array.isArray(cls)
          ? cls.map(String)
          : typeof cls === 'string'
            ? cls.split(/\s+/)
            : [];
        if (list.includes('docs-table-wrap')) return;
      }
      parent.children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['docs-table-wrap'] },
        children: [node],
      };
    });
  };
}

function createRehypeHeadingsPlugin(headings) {
  const slugger = new GithubSlugger();
  return () => (tree) => {
    visit(tree, 'element', (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      const depth = Number(node.tagName.slice(1));
      const text = hastToString(node).trim();
      if (!text) return;
      const slug = slugger.slug(text);
      node.properties = node.properties || {};
      if (!node.properties.id) {
        node.properties.id = slug;
      }
      headings.push({
        depth,
        slug: String(node.properties.id),
        text,
      });
    });
  };
}

function walkMarkdownFiles(dir, list = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkMarkdownFiles(full, list);
    else if (name.endsWith('.md')) list.push(full);
  }
  return list;
}

async function buildDocsManifest() {
  const files = walkMarkdownFiles(CONTENT_ROOT);
  const manifest = {};

  for (const file of files) {
    const rel = relative(CONTENT_ROOT, file).split('\\').join(posix.sep);
    const entryId = rel.replace(/\.md$/, '');
    const raw = readFileSync(file, 'utf8');
    const { data, content } = parseFrontmatter(raw);
    const headings = [];

    const fileResult = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkDirective)
      .use(remarkAsidesPlugin)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(createRehypeHeadingsPlugin(headings))
      .use(rehypeWrapTablesPlugin)
      .use(rehypeStringify)
      .process(content);

    manifest[entryId] = {
      title: data.title || entryId,
      description: data.description || '',
      html: String(fileResult),
      headings,
    };
  }

  return manifest;
}

const FALLBACK_CONTRIBUTORS = [
  {
    login: 'Anson-Trio',
    avatar_url: 'https://avatars.githubusercontent.com/u/107763915?v=4',
    html_url: 'https://github.com/Anson-Trio',
    contributions: 3334,
  },
  {
    login: 'ctnilpp',
    avatar_url: 'https://avatars.githubusercontent.com/u/49940531?v=4',
    html_url: 'https://github.com/ctnilpp',
    contributions: 2,
  },
  {
    login: 'Asamizu-saki',
    avatar_url: 'https://avatars.githubusercontent.com/u/231084446?v=4',
    html_url: 'https://github.com/Asamizu-saki',
    contributions: 1,
  },
  {
    login: 'C-H-001',
    avatar_url: 'https://avatars.githubusercontent.com/u/93237727?v=4',
    html_url: 'https://github.com/C-H-001',
    contributions: 1,
  },
  {
    login: 'david082321',
    avatar_url: 'https://avatars.githubusercontent.com/u/7046617?v=4',
    html_url: 'https://github.com/david082321',
    contributions: 1,
  },
  {
    login: 'Magnemomet',
    avatar_url: 'https://avatars.githubusercontent.com/u/269363200?v=4',
    html_url: 'https://github.com/Magnemomet',
    contributions: 1,
  },
  {
    login: 'fisHarly0',
    avatar_url: 'https://avatars.githubusercontent.com/u/188205924?v=4',
    html_url: 'https://github.com/fisHarly0',
    contributions: 1,
  },
];

async function fetchBuildDownloads() {
  const fallback = {
    android: { url: 'https://dl.foxletters.com/latest/BaiShou-Android.apk' },
    windows: { url: 'https://dl.foxletters.com/latest/BaiShou-Windows-Setup.exe' },
  };
  const candidates = [
    'https://dl.foxletters.com/channel.json',
    'https://raw.githubusercontent.com/foxletters-hq/BaiShou-Next/main/releases/channel.json',
  ];
  for (const manifestUrl of candidates) {
    try {
      const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const data = await res.json();
      return {
        android: {
          url: data.android?.downloadUrl ?? fallback.android.url,
          version: data.android?.version,
        },
        windows: {
          url: data.windows?.downloadUrl ?? fallback.windows.url,
          version: data.windows?.version,
        },
      };
    } catch {
      // try next candidate
    }
  }
  return fallback;
}

async function main() {
  mkdirSync(GENERATED_DIR, { recursive: true });
  const docsManifest = await buildDocsManifest();
  writeFileSync(
    join(GENERATED_DIR, 'docs-manifest.json'),
    JSON.stringify(docsManifest, null, 2),
    'utf8',
  );

  const downloads = await fetchBuildDownloads();
  writeFileSync(
    join(GENERATED_DIR, 'build-data.json'),
    JSON.stringify({ downloads, contributors: FALLBACK_CONTRIBUTORS }, null, 2),
    'utf8',
  );
  console.log(
    `已生成文档清单（共 ${Object.keys(docsManifest).length} 篇）与构建初始数据。`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
