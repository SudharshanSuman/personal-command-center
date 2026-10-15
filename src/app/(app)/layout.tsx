"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth, AuthGuard } from "@/local/auth-context"
import { AppShell } from "@/components/app-shell"

function AppInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !user.profile?.onboardingCompleted) router.replace("/onboarding")
  }, [user, router])

  if (!user) return null
  if (!user.profile?.onboardingCompleted) return null

  return <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppInner>{children}</AppInner>
    </AuthGuard>
  )
}
