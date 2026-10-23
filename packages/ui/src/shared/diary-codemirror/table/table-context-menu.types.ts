export type TableMenuItem = {
  id: string
  label: string
  disabled?: boolean
  destructive?: boolean
}

export type TableMenuSection = { items: TableMenuItem[] }
