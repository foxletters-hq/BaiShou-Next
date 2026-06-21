import React from 'react'
import type { TFunction } from 'i18next'
import styles from './ContextChainCompressionHelpButton.module.css'

export function ContextChainCompressionHelpContent({ t }: { t: TFunction }) {
  return (
    <div className={styles.compressionHelpContent}>
      <p className={styles.compressionHelpLead}>
        {t(
          'agent.chat.compression_help_intro',
          '当对话上下文超过伙伴设置的 Token 阈值时，系统会把更早的对话合并为一条「对话压缩」摘要，再与近期完整轮次一起发给模型。'
        )}
      </p>

      <section>
        <h4 className={styles.compressionHelpSectionTitle}>
          {t('agent.chat.compression_help_trigger_title', '何时触发')}
        </h4>
        <p className={styles.compressionHelpSectionBody}>
          {t(
            'agent.chat.compression_help_trigger_body',
            '在伙伴设置中开启「自动压缩」并设定阈值（0 表示关闭）。每次发送前与回复落盘后都会检测；超过阈值则调用模型生成/更新摘要，并剪枝过长的工具输出。'
          )}
        </p>
      </section>

      <section>
        <h4 className={styles.compressionHelpSectionTitle}>
          {t('agent.chat.compression_help_chain_title', '调用链展示顺序')}
        </h4>
        <div className={styles.compressionHelpRows}>
          <p className={styles.compressionHelpRow}>
            {t('agent.chat.compression_help_chain_1', '系统提示词（独立一块）')}
          </p>
          <p className={styles.compressionHelpRow}>
            {t('agent.chat.compression_help_chain_2', '对话压缩（独立一块，介于轮次之间）')}
          </p>
          <p className={styles.compressionHelpRow}>
            {t(
              'agent.chat.compression_help_chain_3',
              '第 1、2… 轮：仅压缩点之后的对话，从第 1 轮重新计数'
            )}
          </p>
        </div>
      </section>

      <section>
        <h4 className={styles.compressionHelpSectionTitle}>
          {t('agent.chat.compression_help_footer_title', '底部指标含义')}
        </h4>
        <div className={styles.compressionHelpRows}>
          <p className={styles.compressionHelpRow}>
            {t(
              'agent.chat.compression_help_footer_tokens',
              '上下文 tokens：系统提示词 + 压缩摘要 + 当前窗口内消息的粗估总量'
            )}
          </p>
          <p className={styles.compressionHelpRow}>
            {t(
              'agent.chat.compression_help_footer_rounds',
              '上下文轮数：压缩后计入窗口的用户轮数 / 伙伴配置的携带轮数上限（不限表示不按轮截断）'
            )}
          </p>
        </div>
      </section>

      <section>
        <h4 className={styles.compressionHelpSectionTitle}>
          {t('agent.chat.compression_help_keep_title', '保留轮数')}
        </h4>
        <p className={styles.compressionHelpSectionBody}>
          {t(
            'agent.chat.compression_help_keep_body',
            '压缩时始终保留最近 N 轮用户消息的完整原文（含该轮 AI 回复与工具调用）；更早内容进入摘要。N 在伙伴设置中配置。'
          )}
        </p>
      </section>

      <section>
        <h4 className={styles.compressionHelpSectionTitle}>
          {t('agent.chat.compression_help_branch_title', '分支与回到更早位置')}
        </h4>
        <p className={styles.compressionHelpSectionBody}>
          {t(
            'agent.chat.compression_help_branch_body',
            '创建分支会复制消息与仍有效的压缩快照。在某条较早消息上重发/编辑重发时，若锚点消息被删除，将回退为完整原文上下文而非摘要。'
          )}
        </p>
      </section>
    </div>
  )
}
