export interface NavItemConfig {
  to: string
  label: string
  icon: string
  roles?: string[]
}

export interface NavSectionConfig {
  id: string
  title: string
  items: NavItemConfig[]
  roles?: string[]
}

export const sections: NavSectionConfig[]