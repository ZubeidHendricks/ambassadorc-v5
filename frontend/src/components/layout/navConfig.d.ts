export interface NavItemConfig {
  to: string
  label: string
  icon: string
  roles?: string[]
}

export interface NavSectionConfig {
  title: string
  items: NavItemConfig[]
  roles?: string[]
}

export const sections: NavSectionConfig[]