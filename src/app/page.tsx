"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/local/auth-context"
import { APP_ROUTES } from "@/local/routes"

export default function RootPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // DEEP-LINK / HARD-RELOAD RECOVERY (QA bug T16-2).
    // Capacitor's on-device WebView server runs in html5mode: it serves THIS
    // root `/` bundle for *any* extensionless path (/tasks, /goals, …), because
    // it assumes a single-page app with a client router (see Capacitor's
    // WebViewLocalServer.handleLocalRequest). So a hard reload under memory
    // pressure, or a deep link to a sub-route, loads the `/` tree instead of
    // that route's own bundle and would bounce the user to /dashboard.
    //
    // Recover by reloading the route's REAL prerendered HTML. Capacitor only
    // applies the index.html fallback to extensionless paths, so a path whose
    // last segment has a "." (…/index.html) is served as the actual asset —
    // bypassing the fallback and loading the correct bundle. UrlTidy (in the
    // root layout) then strips the "index.html" back off the address bar.
    if (typeof window !== "undefined") {
      const requested = window.location.pathname.replace(/\/+$/, "")
      if (requested !== "" && APP_ROUTES.has(requested)) {
        window.location.replace(requested + "/index.html")
        return
      }
    }

    // Genuine root (`/`): send to the dashboard or login per auth state.
    if (loading) return
    router.replace(user ? "/dashboard" : "/login")
  }, [user, loading, router])

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  )
}
