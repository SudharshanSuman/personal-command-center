/* eslint-disable @typescript-eslint/no-explicit-any */
// LOCAL-FIRST data client — a Prisma-compatible facade over on-device SQLite.
//
// The server build used the real Prisma client. On device there is no Node
// server, so `db` here implements exactly the subset of the Prisma query API
// this codebase uses (findMany/findUnique/create/update/delete/createMany/
// upsert with where/include/orderBy), backed by @capacitor-community/sqlite.
// Action files and page loaders keep calling `db.task.findMany(...)` etc.
// unchanged. `select` is intentionally ignored (returning the full row is a
// harmless superset of any projection). See Documentation/AndroidLocalFirst.md.

import { query as sqlQuery, run as sqlRun } from "@/local/sqlite"
import { createId } from "@/local/id"

type Row = Record<string, unknown>

interface Relation {
  kind: "many" | "one"
  table: string // related table
  localKey: string // column on THIS row used to match
  foreignKey: string // column on the related table
}

interface ModelMeta {
  table: string
  dateFields: string[]
  boolFields: string[]
  relations: Record<string, Relation>
  // relation-filter: where key -> { localFk, table } => localFk IN (SELECT id FROM table WHERE <sub>)
  relationFilters: Record<string, { localFk: string; table: string }>
  enumOrder: Record<string, string[]> // column -> ordered enum values
}

const META: Record<string, ModelMeta> = {
  user: {
    table: "users",
    dateFields: ["createdAt", "updatedAt"],
    boolFields: [],
    relations: {
      profile: { kind: "one", table: "personalization_profiles", localKey: "id", foreignKey: "userId" },
    },
    relationFilters: {},
    enumOrder: {},
  },
  personalizationProfile: {
    table: "personalization_profiles",
    dateFields: ["createdAt", "updatedAt"],
    boolFields: ["notificationsEnabled", "onboardingCompleted"],
    relations: {},
    relationFilters: {},
    enumOrder: {},
  },
  goal: {
    table: "goals",
    dateFields: ["targetDate", "createdAt", "updatedAt"],
    boolFields: [],
    relations: { tasks: { kind: "many", table: "tasks", localKey: "id", foreignKey: "goalId" } },
    relationFilters: {},
    enumOrder: { status: ["ACTIVE", "COMPLETED", "ABANDONED"] },
  },
  assessment: {
    table: "assessments",
    dateFields: ["date", "createdAt", "updatedAt"],
    boolFields: [],
    relations: {
      events: { kind: "many", table: "events", localKey: "id", foreignKey: "assessmentId" },
      reminderRules: { kind: "many", table: "reminder_rules", localKey: "id", foreignKey: "assessmentId" },
      tasks: { kind: "many", table: "tasks", localKey: "id", foreignKey: "assessmentId" },
    },
    relationFilters: {},
    enumOrder: {},
  },
  task: {
    table: "tasks",
    dateFields: ["dueDate", "createdAt", "updatedAt"],
    boolFields: [],
    relations: {
      subtasks: { kind: "many", table: "tasks", localKey: "id", foreignKey: "parentTaskId" },
      reminderRules: { kind: "many", table: "reminder_rules", localKey: "id", foreignKey: "taskId" },
      events: { kind: "many", table: "events", localKey: "id", foreignKey: "taskId" },
      goal: { kind: "one", table: "goals", localKey: "goalId", foreignKey: "id" },
      assessment: { kind: "one", table: "assessments", localKey: "assessmentId", foreignKey: "id" },
    },
    relationFilters: {},
    enumOrder: {
      status: ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
    },
  },
  event: {
    table: "events",
    dateFields: ["startsAt", "endsAt", "createdAt", "updatedAt"],
    boolFields: ["allDay"],
    relations: {
      task: { kind: "one", table: "tasks", localKey: "taskId", foreignKey: "id" },
      assessment: { kind: "one", table: "assessments", localKey: "assessmentId", foreignKey: "id" },
    },
    relationFilters: {},
    enumOrder: {},
  },
  reminderRule: {
    table: "reminder_rules",
    dateFields: ["lastFiredAt", "dismissedAt", "createdAt", "updatedAt"],
    boolFields: [],
    relations: {
      task: { kind: "one", table: "tasks", localKey: "taskId", foreignKey: "id" },
      assessment: { kind: "one", table: "assessments", localKey: "assessmentId", foreignKey: "id" },
    },
    relationFilters: {},
    enumOrder: {},
  },
  habit: {
    table: "habits",
    dateFields: ["createdAt", "updatedAt"],
    boolFields: ["active"],
    relations: { logs: { kind: "many", table: "habit_logs", localKey: "id", foreignKey: "habitId" } },
    relationFilters: {},
    enumOrder: {},
  },
  habitLog: {
    table: "habit_logs",
    dateFields: ["date", "createdAt"],
    boolFields: ["completed"],
    relations: { habit: { kind: "one", table: "habits", localKey: "habitId", foreignKey: "id" } },
    relationFilters: { habit: { localFk: "habitId", table: "habits" } },
    enumOrder: {},
  },
  transaction: {
    table: "transactions",
    dateFields: ["date", "createdAt", "updatedAt"],
    boolFields: [],
    relations: {},
    relationFilters: {},
    enumOrder: {},
  },
  budget: {
    table: "budgets",
    dateFields: ["createdAt", "updatedAt"],
    boolFields: [],
    relations: {},
    relationFilters: {},
    enumOrder: {},
  },
  dailyReview: {
    table: "daily_reviews",
    dateFields: ["createdAt", "updatedAt", "date"],
    boolFields: [],
    relations: {},
    relationFilters: {},
    enumOrder: {},
  },
}

// --- value coercion --------------------------------------------------------

function toParam(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "boolean") return v ? 1 : 0
  if (v === undefined) return null
  return v
}

function cleanRecord(data: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(data)) {
    // Exclude synthetic compound-unique keys or relation objects (objects that are not Date)
    if (v !== null && typeof v === "object" && !(v instanceof Date)) {
      continue
    }
    out[k] = v
  }
  return out
}

function mapRow(meta: ModelMeta, row: Row): Row {
  if (!row) return row
  const out: Row = { ...row }
  for (const f of meta.dateFields) {
    const val = out[f]
    out[f] = val == null ? null : val instanceof Date ? val : new Date(String(val))
  }
  for (const f of meta.boolFields) {
    const val = out[f]
    out[f] = val == null ? null : !!Number(val)
  }
  return out
}

// --- WHERE builder ---------------------------------------------------------

function buildWhere(
  meta: ModelMeta,
  where: Row | undefined
): { sql: string; params: unknown[] } {
  if (!where) return { sql: "", params: [] }
  const clauses: string[] = []
  const params: unknown[] = []

  for (const [key, raw] of Object.entries(where)) {
    // relation filter: habit: { userId: ... } -> habitId IN (SELECT id ...)
    const rf = meta.relationFilters[key]
    if (rf && raw && typeof raw === "object" && !(raw instanceof Date)) {
      const subMeta = Object.values(META).find((m) => m.table === rf.table)!
      const sub = buildWhere(subMeta, raw as Row)
      clauses.push(`${rf.localFk} IN (SELECT id FROM ${rf.table}${sub.sql ? " " + sub.sql : ""})`)
      params.push(...sub.params)
      continue
    }

    if (raw === null) {
      clauses.push(`${key} IS NULL`)
      continue
    }

    if (raw !== null && typeof raw === "object" && !(raw instanceof Date)) {
      const ops = raw as Row
      const OP_KEYS = new Set(["gte", "gt", "lte", "lt", "not", "in", "contains", "mode", "equals"])
      const isOperatorObject = Object.keys(ops).every((k) => OP_KEYS.has(k))
      // Prisma compound-unique keys, e.g. where.userId_period_date = { userId, period, date }.
      // The key name is a join of the real columns; expand the nested object as
      // ANDed equality conditions and ignore the synthetic key name.
      if (!isOperatorObject) {
        const sub = buildWhere(meta, ops)
        if (sub.sql) {
          clauses.push(sub.sql.replace(/^WHERE /, ""))
          params.push(...sub.params)
        }
        continue
      }
      for (const [op, val] of Object.entries(ops)) {
        switch (op) {
          case "gte":
            clauses.push(`${key} >= ?`)
            params.push(toParam(val))
            break
          case "gt":
            clauses.push(`${key} > ?`)
            params.push(toParam(val))
            break
          case "lte":
            clauses.push(`${key} <= ?`)
            params.push(toParam(val))
            break
          case "lt":
            clauses.push(`${key} < ?`)
            params.push(toParam(val))
            break
          case "not":
            if (val === null) clauses.push(`${key} IS NOT NULL`)
            else {
              clauses.push(`${key} != ?`)
              params.push(toParam(val))
            }
            break
          case "in": {
            const arr = (val as unknown[]) ?? []
            if (arr.length === 0) clauses.push("0 = 1")
            else {
              clauses.push(`${key} IN (${arr.map(() => "?").join(",")})`)
              params.push(...arr.map(toParam))
            }
            break
          }
          case "contains":
            clauses.push(`${key} LIKE ? ESCAPE '\\'`)
            params.push(`%${String(val).replace(/[%_\\]/g, (c) => "\\" + c)}%`)
            break
          case "mode":
            break // SQLite LIKE is case-insensitive for ASCII; ignore
          default:
            clauses.push(`${key} = ?`)
            params.push(toParam(val))
        }
      }
      continue
    }

    clauses.push(`${key} = ?`)
    params.push(toParam(raw))
  }

  return { sql: clauses.length ? "WHERE " + clauses.join(" AND ") : "", params }
}

// --- ORDER BY builder ------------------------------------------------------

function buildOrderBy(meta: ModelMeta, orderBy: unknown): string {
  if (!orderBy) return ""
  const items = Array.isArray(orderBy) ? orderBy : [orderBy]
  const parts: string[] = []
  for (const item of items) {
    for (const [col, dir] of Object.entries(item as Row)) {
      const d = String(dir).toUpperCase() === "DESC" ? "DESC" : "ASC"
      const order = meta.enumOrder[col]
      if (order) {
        const cases = order.map((v, i) => `WHEN '${v}' THEN ${i}`).join(" ")
        parts.push(`CASE ${col} ${cases} ELSE ${order.length} END ${d}`)
      } else {
        parts.push(`${col} ${d}`)
      }
    }
  }
  return parts.length ? "ORDER BY " + parts.join(", ") : ""
}

// --- include resolution ----------------------------------------------------

async function applyInclude(
  meta: ModelMeta,
  rows: Row[],
  include: Row | undefined
): Promise<void> {
  if (!include || rows.length === 0) return
  for (const [relName, relArg] of Object.entries(include)) {
    if (!relArg) continue
    const rel = meta.relations[relName]
    if (!rel) continue
    const relMeta = Object.values(META).find((m) => m.table === rel.table)!
    const arg = (typeof relArg === "object" ? (relArg as Row) : {}) as Row

    for (const row of rows) {
      const keyVal = row[rel.localKey]
      if (rel.kind === "one") {
        if (keyVal == null) {
          row[relName] = null
          continue
        }
        const where = { ...(arg.where as Row), [rel.foreignKey]: keyVal }
        const found = await findManyRaw(relMeta, {
          where,
          include: arg.include as Row,
          orderBy: arg.orderBy,
          take: 1,
        })
        row[relName] = found[0] ?? null
      } else {
        const where = { ...(arg.where as Row), [rel.foreignKey]: keyVal }
        row[relName] = await findManyRaw(relMeta, {
          where,
          include: arg.include as Row,
          orderBy: arg.orderBy,
        })
      }
    }
  }
}

interface FindArgs {
  where?: Row
  include?: Row
  orderBy?: unknown
  take?: number
  select?: Row
}

async function findManyRaw(meta: ModelMeta, args: FindArgs): Promise<Row[]> {
  const { sql: whereSql, params } = buildWhere(meta, args.where)
  const orderSql = buildOrderBy(meta, args.orderBy)
  const limitSql = args.take ? `LIMIT ${Number(args.take)}` : ""
  const rows = await sqlQuery<Row>(
    `SELECT * FROM ${meta.table} ${whereSql} ${orderSql} ${limitSql}`.trim(),
    params
  )
  const mapped = rows.map((r) => mapRow(meta, r))
  await applyInclude(meta, mapped, args.include)
  return mapped
}

// --- write helpers ---------------------------------------------------------

async function createRaw(meta: ModelMeta, data: Row): Promise<Row> {
  const now = new Date().toISOString()
  const record: Row = cleanRecord(data)
  if (record.id == null) record.id = createId()
  if (meta.dateFields.includes("createdAt") && record.createdAt == null) record.createdAt = now
  if (meta.dateFields.includes("updatedAt") && record.updatedAt == null) record.updatedAt = now
  const cols = Object.keys(record)
  const placeholders = cols.map(() => "?").join(",")
  await sqlRun(
    `INSERT INTO ${meta.table} (${cols.join(",")}) VALUES (${placeholders})`,
    cols.map((c) => toParam(record[c]))
  )
  const created = await sqlQuery<Row>(`SELECT * FROM ${meta.table} WHERE id = ?`, [record.id])
  return mapRow(meta, created[0])
}

async function updateRaw(meta: ModelMeta, where: Row, data: Row): Promise<Row> {
  const record: Row = cleanRecord(data)
  if (meta.dateFields.includes("updatedAt")) record.updatedAt = new Date().toISOString()
  const cols = Object.keys(record)
  const { sql: whereSql, params: whereParams } = buildWhere(meta, where)
  if (cols.length > 0) {
    await sqlRun(
      `UPDATE ${meta.table} SET ${cols.map((c) => `${c} = ?`).join(",")} ${whereSql}`,
      [...cols.map((c) => toParam(record[c])), ...whereParams]
    )
  }
  const updated = await sqlQuery<Row>(`SELECT * FROM ${meta.table} ${whereSql}`, whereParams)
  return mapRow(meta, updated[0])
}

interface ModelDelegate {
  findMany(args?: any): Promise<any[]>
  findUnique(args: any): Promise<any>
  findFirst(args?: any): Promise<any>
  create(args: any): Promise<any>
  createMany(args: any): Promise<{ count: number }>
  update(args: any): Promise<any>
  delete(args: any): Promise<any>
  deleteMany(args?: any): Promise<{ count: number }>
  upsert(args: any): Promise<any>
  count(args?: any): Promise<number>
}

function makeModel(key: string): ModelDelegate {
  const meta = META[key]
  return {
    findMany: (args: FindArgs = {}) => findManyRaw(meta, args),
    findUnique: async (args: { where: Row; include?: Row }) => {
      const rows = await findManyRaw(meta, { where: args.where, include: args.include, take: 1 })
      return rows[0] ?? null
    },
    findFirst: async (args: FindArgs = {}) => {
      const rows = await findManyRaw(meta, { ...args, take: 1 })
      return rows[0] ?? null
    },
    create: (args: { data: Row }) => createRaw(meta, args.data),
    createMany: async (args: { data: Row[] }) => {
      for (const d of args.data) await createRaw(meta, d)
      return { count: args.data.length }
    },
    update: (args: { where: Row; data: Row }) => updateRaw(meta, args.where, args.data),
    delete: async (args: { where: Row }) => {
      const { sql: whereSql, params } = buildWhere(meta, args.where)
      const existing = await sqlQuery<Row>(`SELECT * FROM ${meta.table} ${whereSql}`, params)
      await sqlRun(`DELETE FROM ${meta.table} ${whereSql}`, params)
      return existing[0] ? mapRow(meta, existing[0]) : null
    },
    deleteMany: async (args: { where?: Row } = {}) => {
      const { sql: whereSql, params } = buildWhere(meta, args.where)
      await sqlRun(`DELETE FROM ${meta.table} ${whereSql}`, params)
      return { count: 0 }
    },
    upsert: async (args: { where: Row; create: Row; update: Row }) => {
      const rows = await findManyRaw(meta, { where: args.where, take: 1 })
      if (rows[0]) return updateRaw(meta, args.where, args.update)
      const createData: Row = { ...args.create }
      for (const [k, v] of Object.entries(args.where)) {
        if (v !== null && typeof v === "object" && !(v instanceof Date)) {
          for (const [subK, subV] of Object.entries(v as Row)) {
            if (createData[subK] === undefined && (typeof subV !== "object" || subV instanceof Date)) {
              createData[subK] = subV
            }
          }
        } else if (createData[k] === undefined) {
          createData[k] = v
        }
      }
      return createRaw(meta, createData)
    },
    count: async (args: { where?: Row } = {}) => {
      const { sql: whereSql, params } = buildWhere(meta, args.where)
      const r = await sqlQuery<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${meta.table} ${whereSql}`,
        params
      )
      return Number(r[0]?.n ?? 0)
    },
  }
}

export const db = {
  user: makeModel("user"),
  personalizationProfile: makeModel("personalizationProfile"),
  goal: makeModel("goal"),
  assessment: makeModel("assessment"),
  task: makeModel("task"),
  event: makeModel("event"),
  reminderRule: makeModel("reminderRule"),
  habit: makeModel("habit"),
  habitLog: makeModel("habitLog"),
  transaction: makeModel("transaction"),
  budget: makeModel("budget"),
  dailyReview: makeModel("dailyReview"),
}
