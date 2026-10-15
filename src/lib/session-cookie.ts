// Isolated from src/lib/session.ts (which imports Prisma) so that
// src/middleware.ts — which runs in the Edge runtime and can't use the
// SQLite-backed Prisma client — can import just the cookie name without
// pulling the DB client into the edge bundle.
export const SESSION_COOKIE_NAME = "pcc_session"
