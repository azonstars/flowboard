import * as LucideIcons from 'lucide-react'

// icon string থেকে Lucide component render করো
// format: "lucide:Home" অথবা "lucide:LayoutDashboard"
export default function LucideIcon({ name, size = 18, className = '' }) {
  if (!name?.startsWith('lucide:')) return null
  const iconName = name.replace('lucide:', '')
  const Icon = LucideIcons[iconName]
  if (!Icon) return <span className={className}>?</span>
  return <Icon size={size} className={className} />
}

// icon string টি Lucide কিনা check করো
export const isLucideIcon = (icon) => typeof icon === 'string' && icon.startsWith('lucide:')

// Sidebar-এ ব্যবহারের জন্য — theme অনুযায়ী render
export const MenuIcon = ({ icon, size = 18, className = '' }) => {
  if (isLucideIcon(icon)) {
    return <LucideIcon name={icon} size={size} className={className} />
  }
  return <span className={`text-lg shrink-0 ${className}`}>{icon || '📋'}</span>
}
