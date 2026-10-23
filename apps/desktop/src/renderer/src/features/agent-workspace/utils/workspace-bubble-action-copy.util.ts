type TranslateFn = (key: string, fallback: string) => string

export type WorkspaceBubbleConfirmCopy = {
  title: string
  intro: string
}

/** 工作台气泡操作的确认文案。删除/重发/重生都会动文件，不能用伙伴页「只删聊天」那套。 */
export function workspaceBubbleActionCopy(
  kind: 'edit_resend' | 'resend' | 'regenerate' | 'delete',
  t: TranslateFn
): WorkspaceBubbleConfirmCopy {
  if (kind === 'resend') {
    return {
      title: t('workspace_resend.confirm_title', '重新发送这一轮？'),
      intro: t(
        'workspace_resend.confirm_desc',
        '会先撤回这一轮及之后的对话，再用原来的内容重新发送。文件怎么处理，请选下面一项。此操作不可撤销。'
      )
    }
  }
  if (kind === 'regenerate') {
    return {
      title: t('workspace_regenerate.confirm_title', '重新生成这一轮？'),
      intro: t(
        'workspace_regenerate.confirm_desc',
        '会先撤回这一轮及之后的对话，再按原来的问题重新生成。文件怎么处理，请选下面一项。此操作不可撤销。'
      )
    }
  }
  if (kind === 'delete') {
    return {
      title: t('workspace_delete_round.confirm_title', '删除这一轮并撤回文件变更？'),
      intro: t(
        'workspace_delete_round.confirm_desc',
        '将恢复本轮开始前的文件状态，并删除本轮及之后的对话。此操作不可撤销。'
      )
    }
  }
  return {
    title: t('workspace_edit_resend.confirm_title', '用编辑后的内容重新发送？'),
    intro: t(
      'workspace_edit_resend.confirm_desc',
      '会先撤回这一轮及之后的对话，再用你改过的内容重新发送。文件怎么处理，请选下面一项。此操作不可撤销。'
    )
  }
}
