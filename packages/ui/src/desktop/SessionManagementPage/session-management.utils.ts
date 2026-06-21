export const formatSessionDate = (
  date: Date,
  t: (key: string, fallback: string) => string
): string => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return t('common.today', '今天')
  if (days === 1) return t('common.yesterday', '昨天')
  if (days < 7) return `${days}${t('common.days_ago', '天前')}`
  return `${date.getMonth() + 1}/${date.getDate()}`
}
