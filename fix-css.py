import re

css_path = 'packages/ui/src/web/CloudSyncPanel/CloudSyncPanel.module.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Replace configGrid to fix input overflow
css_content = css_content.replace('grid-template-columns: 1fr 1fr;', 'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);')
css_content = css_content.replace('grid-template-columns: 1fr;', 'grid-template-columns: minmax(0, 1fr);')

# Find the end of the file where duplicated formField is (assuming it appears twice)
first_idx = css_content.find('.configGrid {')
second_idx = css_content.find('.configGrid {', first_idx + 1)
# if we found a duplicate config grid after the form field, maybe we can strip the first one.
# Wait, let's just make sure .configGrid resolves the grid-template columns, which we just did!

if '.configSectionFooter' not in css_content:
    css_content += '''
.configSectionFooter {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-outline-variant, rgba(0, 0, 0, 0.08));
  margin-top: 24px;
  padding-top: 24px;
}
:global(body[data-theme='dark']) .configSectionFooter {
  border-top-color: rgba(255,255,255,0.05);
}
'''

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content)

print('CSS Updated')
