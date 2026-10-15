// On-device SQLite connection manager for the local-first build.
//
// Wraps @capacitor-community/sqlite. On Android (and iOS) this talks to the
// native SQLite database on the device — no network, no server, fully offline.
// On the web (used for `npm run dev` testing and a potential Electron desktop
// build) it falls back to the plugin's jeep-sqlite WASM store persisted in the
// browser's IndexedDB. The JS API is identical across platforms.
//
// RELOAD ROBUSTNESS (QA bug T16-1): a native SQLite connection SURVIVES a full
// WebView reload — Android routinely reloads foregrounded WebViews under memory
// pressure — but the reloaded JS context starts with an empty connection map.
// Reopening the surviving connection has been observed to deadlock the *next*
// native query (the promise never settles), which froze the app on "Loading…".
// Two defenses below make this impossible: every DB op is (a) serialized so
// calls can't collide at the bridge, and (b) wrapped in a timeout that tears the
// connection down and retries once — so a hung native call self-heals and can
// never freeze the UI forever. Init also force-closes any surviving native
// connection before recreating, so the reload path converges with a cold start.

import { Capacitor } from "@capacitor/core"
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite"
import { SCHEMA_SQL } from "./schema"

const DB_NAME = "pcc"
const OP_TIMEOUT_MS = 5000

let sqlite: SQLiteConnection | null = null
let dbConn: SQLiteDBConnection | null = null
let initPromise: Promise<SQLiteDBConnection> | null = null
let opChain: Promise<unknown> = Promise.resolve()

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("sqlite-timeout:" + label)), ms)
  })
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer)) as Promise<T>
}

async function initWebStoreIfNeeded(): Promise<void> {
  if (Capacitor.getPlatform() !== "web") return
  // Lazy-load jeep-sqlite only on web so native builds don't bundle it.
  const jeep = await import("jeep-sqlite/loader").catch(() => null)
  if (jeep && typeof jeep.defineCustomElements === "function") {
    jeep.defineCustomElements(window)
  }
  if (!document.querySelector("jeep-sqlite")) {
    const el = document.createElement("jeep-sqlite")
    document.body.appendChild(el)
    await customElements.whenDefined("jeep-sqlite").catch(() => {})
  }
  await CapacitorSQLite.initWebStore()
}

async function doInit(): Promise<SQLiteDBConnection> {
  sqlite = new SQLiteConnection(CapacitorSQLite)
  await initWebStoreIfNeeded()

  // Does a native "pcc" connection already exist? After a WebView reload the
  // native connection SURVIVES (still open, schema + PRAGMA intact) while this
  // fresh JS context has no handle to it. The raw plugin's isConnection reports
  // native state (SQLiteConnection.isConnection only checks the JS map, which is
  // empty here). NOTE: this native-aware check is the crux of the reload fix.
  let nativeExists = false
  try {
    // isConnection exists on the plugin at runtime (SQLiteConnection.isConnection
    // delegates to it) but isn't in the exported plugin type; cast to reach it.
    const rawPlugin = CapacitorSQLite as unknown as {
      isConnection(o: { database: string; readonly: boolean }): Promise<{ result: boolean }>
    }
    nativeExists = (await rawPlugin.isConnection({ database: DB_NAME, readonly: false })).result
  } catch {}

  if (nativeExists) {
    // REUSE the surviving connection. Do NOT close+recreate it — doing so has
    // been observed to corrupt the native connection after a reload so that the
    // *second* query never returns, hanging the app on "Loading…" forever
    // (QA bug T16-1). Wrapping the live native connection with a fresh JS handle
    // avoids that entirely; schema + foreign_keys PRAGMA already persist on it.
    dbConn = new SQLiteDBConnection(DB_NAME, false, CapacitorSQLite)
    if (!(await dbConn.isDBOpen()).result) {
      await dbConn.open()
    }
  } else {
    // Cold start (fresh process): create, open, and initialise the schema.
    dbConn = await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false)
    await dbConn.open()
    // Idempotent DDL; run without the plugin's implicit BEGIN/COMMIT wrapper.
    await dbConn.execute("PRAGMA foreign_keys = ON;", false)
    await dbConn.execute(SCHEMA_SQL, false)
  }

  if (Capacitor.getPlatform() === "web") {
    await sqlite.saveToStore(DB_NAME)
  }
  return dbConn
}

function getDB(): Promise<SQLiteDBConnection> {
  if (dbConn) return Promise.resolve(dbConn)
  if (!initPromise) {
    initPromise = doInit().catch((e) => {
      initPromise = null // allow a later retry to re-initialise
      throw e
    })
  }
  return initPromise
}

async function teardown(): Promise<void> {
  const s = sqlite
  dbConn = null
  initPromise = null
  sqlite = null
  try {
    await withTimeout(
      CapacitorSQLite.closeConnection({ database: DB_NAME, readonly: false }),
      OP_TIMEOUT_MS,
      "teardown-close"
    )
  } catch {}
  try {
    if (s) await withTimeout(s.closeConnection(DB_NAME, false), OP_TIMEOUT_MS, "teardown-close2")
  } catch {}
}

/**
 * Serialize + timeout-guard every DB operation. If a native call hangs (seen
 * after a WebView reload), the timeout fires, we tear the connection down and
 * reinitialise, then retry the op once. If it still fails it rejects — callers
 * (e.g. AuthProvider) treat that as "no data" rather than hanging forever.
 */
function op<T>(fn: (db: SQLiteDBConnection) => Promise<T>, label: string): Promise<T> {
  const run = async (): Promise<T> => {
    try {
      const db = await withTimeout(getDB(), OP_TIMEOUT_MS, "init:" + label)
      return await withTimeout(fn(db), OP_TIMEOUT_MS, label)
    } catch (e) {
      if (!String((e as Error)?.message).startsWith("sqlite-timeout")) throw e
      await teardown()
      const db = await withTimeout(getDB(), OP_TIMEOUT_MS, "reinit:" + label)
      return await withTimeout(fn(db), OP_TIMEOUT_MS, "retry:" + label)
    }
  }
  const result = opChain.then(run, run)
  opChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

/** Persist the web store after writes (no-op on native, which writes through). */
async function persistWeb(): Promise<void> {
  if (Capacitor.getPlatform() === "web" && sqlite) {
    await sqlite.saveToStore(DB_NAME).catch(() => {})
  }
}

/** SELECT helper — returns typed rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = []
): Promise<T[]> {
  return op(async (db) => {
    const res = await db.query(sql, values as never[])
    return (res.values ?? []) as T[]
  }, "query")
}

/** Single-row SELECT convenience. */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  values: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, values)
  return rows[0] ?? null
}

/** INSERT/UPDATE/DELETE helper. */
export async function run(sql: string, values: unknown[] = []): Promise<void> {
  await op(async (db) => {
    await db.run(sql, values as never[])
    await persistWeb()
  }, "run")
}

/** Run several statements (DDL / batch). */
export async function exec(statements: string): Promise<void> {
  await op(async (db) => {
    await db.execute(statements, false)
    await persistWeb()
  }, "exec")
}

/** Ensure the database is initialised (used to warm the connection on boot). */
export async function ensureReady(): Promise<void> {
  await op(async () => undefined, "ensureReady")
}
