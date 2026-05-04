/**
 * ESLint自定义规则：检测硬编码的中文字符
 * 
 * 规则说明：
 * - 检测TSX/JSX文件中的硬编码中文字符
 * - 忽略注释中的中文
 * - 忽略t()函数调用中的默认值参数
 * - 忽略import语句
 */

const CHINESE_REGEX = /[\u4e00-\u9fa5]/;

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: '检测未使用i18n的硬编码中文字符',
      category: 'Internationalization',
      recommended: true,
    },
    messages: {
      hardcodedChinese: '发现硬编码中文 "{{text}}"，请使用 t() 函数进行国际化。',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();
    
    // 检查是否在t()函数调用内部
    function isInsideTCall(node) {
      let parent = node.parent;
      while (parent) {
        // 检查是否是CallExpression且callee是t
        if (
          parent.type === 'CallExpression' &&
          parent.callee &&
          (parent.callee.name === 't' || 
           (parent.callee.type === 'MemberExpression' && parent.callee.property?.name === 't'))
        ) {
          return true;
        }
        // 检查是否是JSXExpressionContainer内的模板字符串
        if (parent.type === 'JSXExpressionContainer') {
          return false;
        }
        parent = parent.parent;
      }
      return false;
    }

    // 检查是否是import语句
    function isImportDeclaration(node) {
      return node.parent?.type === 'ImportDeclaration';
    }

    return {
      // 检查字符串字面量
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (!CHINESE_REGEX.test(node.value)) return;
        if (isInsideTCall(node)) return;
        if (isImportDeclaration(node)) return;
        
        // 忽略注释
        const comments = sourceCode.getCommentsBefore(node);
        const isComment = comments.some(c => 
          c.value.includes(node.value) || node.value.includes(c.value)
        );
        if (isComment) return;

        context.report({
          node,
          messageId: 'hardcodedChinese',
          data: {
            text: node.value.substring(0, 20) + (node.value.length > 20 ? '...' : ''),
          },
        });
      },

      // 检查JSX文本内容
      JSXText(node) {
        const text = node.value.trim();
        if (!text) return;
        if (!CHINESE_REGEX.test(text)) return;
        
        context.report({
          node,
          messageId: 'hardcodedChinese',
          data: {
            text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
          },
        });
      },

      // 检查模板字符串
      TemplateLiteral(node) {
        if (isInsideTCall(node)) return;
        
        const text = node.quasis.map(q => q.value.raw).join('');
        if (!CHINESE_REGEX.test(text)) return;
        
        // 检查是否在JSX属性中（如title, placeholder等）
        const parent = node.parent;
        if (parent?.type === 'JSXExpressionContainer') {
          context.report({
            node,
            messageId: 'hardcodedChinese',
            data: {
              text: text.substring(0, 20) + (text.length > 20 ? '...' : ''),
            },
          });
        }
      },
    };
  },
};
