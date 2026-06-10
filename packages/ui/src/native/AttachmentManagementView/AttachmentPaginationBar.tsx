import React from 'react'
import { View } from 'react-native'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import { attachmentManagementStyles as styles } from './attachment-management.styles'

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 80, 100]

interface AttachmentPaginationBarProps {
  current: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export const AttachmentPaginationBar: React.FC<AttachmentPaginationBarProps> = ({
  current,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange
}) => (
  <View style={styles.paginationRow}>
    <PageSizeSelector value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={onPageSizeChange} />
    <Pagination
      current={current}
      total={total}
      onChange={onPageChange}
      showFirstLast
      showJumper
    />
  </View>
)
