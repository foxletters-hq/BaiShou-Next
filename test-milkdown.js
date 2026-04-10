
const { unified } = require('unified');
const remarkStringify = require('remark-stringify');

const ast = {
  type: 'root',
  children: [
    {
      type: 'paragraph',
      children: [
        { type: 'text', value: 'hello' },
        { type: 'break' },
        { type: 'text', value: 'world' }
      ]
    }
  ]
};

const str = unified().use(remarkStringify).stringify(ast);
console.log(str);

