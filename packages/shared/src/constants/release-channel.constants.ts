import { GITHUB_REPO_URL } from './github.constants'

/** CI 发版后写入 main 的各端最新下载清单 */
export const RELEASE_CHANNEL_MANIFEST_URL = `${GITHUB_REPO_URL}/raw/main/releases/channel.json`
