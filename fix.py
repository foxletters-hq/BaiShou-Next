import re

# FIX TSX
tsx_path = 'packages/ui/src/web/CloudSyncPanel/index.tsx'
with open(tsx_path, 'r', encoding='utf-8') as f:
    tsx_content = f.read()

# Insert the button at the bottom of the form
footer_html = '''
              <div className={styles.configSectionFooter}>
                <button className={\ \} onClick={handleSaveConfig}>
                  {t('data_sync.save_config_button', '保存配置')}
                </button>
              </div>'''

old_tail = '''                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>'''

new_tail = f'''                    </div>
                  </div>
                </div>
              )}{footer_html}
            </div>
          </div>
        </div>
      </motion.div>'''

if footer_html not in tsx_content:
    tsx_content = tsx_content.replace(old_tail, new_tail)

with open(tsx_path, 'w', encoding='utf-8') as f:
    f.write(tsx_content)

# FIX CSS
css_path = 'packages/ui/src/web/CloudSyncPanel/CloudSyncPanel.module.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css_content = f.read()

# Remove anything from duplicate configGrid downwards and overwrite.
# Let's find index of ".configGrid"
duplicate_start = css_content.rfind('.configGrid {')

if '.pillIcon' in css_content and duplicate_start > 0 and duplicate_start > css_content.find('.configGrid {') + 10:
    # We have duplicates, let's keep only up to duplicate_start
    # Actually wait! The second copy has the minmax(0, 1fr) or new inputs like .pillIcon but NO! 
    # The view_file output showed the second part had .pillIcon and .eyeBtn while the first didn't. 
    pass

# Direct replacement for the base configGrid rule to use minmax:
css_content = css_content.replace('grid-template-columns: 1fr 1fr;', 'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);')
css_content = css_content.replace('grid-template-columns: 1fr;', 'grid-template-columns: minmax(0, 1fr);')

# Add footer style
if '.configSectionFooter' not in css_content:
    css_content += '''
.configSectionFooter {
  display: flex;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
}
'''

with open(css_path, 'w', encoding='utf-8') as f:
    f.write(css_content)

print("FIXED")
