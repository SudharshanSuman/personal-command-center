"use client"

import { useEffect } from "react"

/**
 * Strips a trailing "index.html" off the address bar after a deep-link/hard-
 * reload recovery (see src/app/page.tsx, QA bug T16-2). The recovery navigates
 * to e.g. /tasks/index.html so Capacitor serves the real route bundle rather
 * than its html5mode index.html fallback; once that bundle has loaded we tidy
 * the URL back to /tasks/ with the History API (no reload, cosmetic only).
 * Rendered once at the app root so it covers every recovered route.
 */
export function UrlTidy() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const { pathname, search, hash } = window.location
    if (pathname.endsWith("/index.html")) {
      const clean = pathname.slice(0, -"index.html".length)
      window.history.replaceState(null, "", clean + search + hash)
    }
  }, [])
  return null
}
