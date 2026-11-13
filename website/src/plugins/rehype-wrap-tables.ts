import { visit } from 'unist-util-visit';
import type { Root } from 'hast';

/** 给 markdown 表格外包一层，便于移动端横向滚动 */
export function rehypeWrapTables() {
  return (tree: Root) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'table') return;
      if (parent == null || typeof index !== 'number') return;
      if (parent.type === 'element' && parent.tagName === 'div') {
        const cls: unknown = parent.properties?.className;
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
