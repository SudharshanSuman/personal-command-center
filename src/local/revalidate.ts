// Client-side stand-in for Next.js server `revalidatePath`.
//
// In the SSR build, a server action calls revalidatePath("/tasks") and Next
// re-renders that route's server component with fresh DB data. In the static
// local-first build there is no server round-trip, so instead we publish a
// lightweight event; client page loaders subscribe via useRevalidate() and
// re-run their SQLite queries when a relevant path changes. The `next/cache`
// import in every action file is aliased to ./shims/next-cache (see
// next.config.mjs), which forwards to revalidate() below — so action code is
// untouched.

type Listener = (path: string) => void

const listeners = new Set<Listener>()

/** Called by the next/cache shim whenever an action revalidates a path. */
export function revalidate(path: string): void {
  listeners.forEach((l) => l(path))
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
