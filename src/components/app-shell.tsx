"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { QuickAddTask } from "@/components/quick-add-task"
import { PRIMARY_NAV, MOBILE_NAV } from "@/components/nav-items"
import { cn } from "@/lib/utils"
import { destroySession } from "@/lib/session"
import { useAuth } from "@/local/auth-context"

export function AppShell({
  user,
  children,
}: {
  user: { name: string | null; email: string }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { refresh } = useAuth()

  async function handleLogout() {
    await destroySession()
    await refresh()
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col border-r px-4 py-6 sm:flex">
        <div className="mb-6 px-2">
          <p className="text-sm font-medium">{user.name || user.email}</p>
          {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}
        </div>

        <QuickAddTask className="mb-6 justify-start gap-2" />

        <nav className="flex flex-1 flex-col gap-1">
          {PRIMARY_NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center justify-between border-t pt-4">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <div className="flex items-center justify-between border-b px-4 py-3 sm:hidden">
        <span className="text-sm font-medium">{user.name || user.email}</span>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Log out"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 pb-16 sm:pb-0">{children}</main>

      <QuickAddTask
        iconOnly
        className="fixed bottom-20 right-4 z-10 h-14 w-14 rounded-full shadow-lg sm:hidden"
      />

      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-background sm:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
