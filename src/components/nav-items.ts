import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Target,
  GraduationCap,
  Repeat,
  Wallet,
  ClipboardCheck,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Assessments", href: "/assessments", icon: GraduationCap },
  { label: "Habits", href: "/habits", icon: Repeat },
  { label: "Finances", href: "/finances", icon: Wallet },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reviews", href: "/reviews", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: Settings },
]

// Subset for the mobile bottom tab bar per IA §2 (4-5 most frequent routes).
export const MOBILE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Habits", href: "/habits", icon: Repeat },
  { label: "More", href: "/settings", icon: Settings },
]
