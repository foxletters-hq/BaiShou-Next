import type { IncrementalCloudOpsHost } from './mobile-incremental-cloud-ops.types'

export function webdavBaseUrl(host: IncrementalCloudOpsHost): string {
  return host.webdavConfiguredBaseUrl()
}
