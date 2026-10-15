// Drop-in replacement for `next/cache` in the local-first client build.
// next.config.mjs aliases "next/cache" to this module so the many action
// files that `import { revalidatePath } from "next/cache"` keep compiling and
// their revalidate calls become client refresh signals (see ../revalidate).
import { revalidate } from "@/local/revalidate"

export function revalidatePath(path: string): void {
  revalidate(path)
}

export function revalidateTag(tag: string): void {
  revalidate(tag)
}

// Present for API-compatibility; unused in the local build.
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T): T => fn
