import i18n from 'i18next'
/** 更新超时错误 */
export class UpdateTimeoutError extends Error {
  constructor() {
    super(
      i18n.t(
        'auto.apps.desktop.src.main.services.updater.errors.L4',
        '检查更新超时，请检查网络后重试'
      )
    )
    this.name = 'UpdateTimeoutError'
  }
}

/** 更新检查失败错误 */
export class UpdateCheckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpdateCheckError'
  }
}
