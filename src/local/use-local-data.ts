"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { subscribe } from "@/local/revalidate"

interface State<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Loads data from on-device SQLite and re-runs the loader whenever an action
 * revalidates a path (or when `deps` change). This is the client-side
 * replacement for a server component's per-request data fetch.
 */
export function useLocalData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = []
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null })
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  const run = useCallback(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    loaderRef.current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((e) => {
        if (!cancelled)
          setState({ data: null, loading: false, error: e?.message ?? "Failed to load" })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    const cancel = run()
    // Any action revalidation re-runs the loader (cheap; single-user local db).
    const unsub = subscribe(() => run())
    return () => {
      cancel()
      unsub()
    }
  }, [run])

  return { ...state, reload: run }
}
