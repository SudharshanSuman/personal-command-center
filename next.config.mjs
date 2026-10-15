import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Local-first Android/desktop build.
 *
 * `output: 'export'` produces a fully static client bundle in `out/` — no Node
 * server. Capacitor bundles `out/` into the APK; on-device SQLite (via
 * @capacitor-community/sqlite) is the only data store. Because there is no
 * server to revalidate, `next/cache` is aliased to a client shim that turns
 * revalidatePath() calls (present throughout the ported action files) into
 * client refresh signals — see src/local/shims/next-cache.ts.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "export",
  // Emit every route as <route>/index.html (e.g. out/tasks/index.html) instead
  // of out/tasks.html. Capacitor's local asset server resolves a directory path
  // to its index.html, but for a bare "tasks.html" it falls back to the ROOT
  // index.html on a hard reload / deep-link — serving the wrong page bundle and
  // bouncing the user to /dashboard (QA bug T16-2). Directory-style routes fix
  // route resolution for hard navigations; in-app <Link> routing is unaffected.
  trailingSlash: true,
  images: { unoptimized: true },
  // The port uses a Prisma-shaped `any`-typed SQLite facade; keep type-checking
  // via `tsc` but don't let lint style rules block the APK build.
  eslint: { ignoreDuringBuilds: true },
  // Static export can't check auth per-request; the client AuthGuard handles it.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next/cache": path.resolve(__dirname, "src/local/shims/next-cache.ts"),
    }
    return config
  },
}

export default nextConfig
