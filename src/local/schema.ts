// On-device SQLite schema for the local-first Android build.
//
// This DDL replicates prisma/schema.prisma (the source of truth for the data
// model) as plain SQLite tables, so every feature — tasks, calendar, goals,
// assessments, reminders, habits, finances, analytics, reviews, settings —
// reads/writes on-device instead of over a network to a PC.
//
// Encoding conventions for the LOCAL db (deliberately self-consistent; this is
// a fresh database created on the phone, not a copy of the server's dev.db):
//   - DateTime  -> TEXT, ISO-8601 (`new Date().toISOString()`)
//   - Boolean   -> INTEGER 0/1
//   - enums     -> TEXT (the enum member name, e.g. "TODO", "HIGH")
//   - JSON blobs (tags, routine, syllabus, ...) -> TEXT (JSON string), same as server
//
// Table names match Prisma's @@map() so mental mapping to schema.prisma is 1:1.

export const SCHEMA_VERSION = 1

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  name TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personalization_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL UNIQUE,
  routine TEXT,
  priorities TEXT,
  importantDates TEXT,
  theme TEXT NOT NULL DEFAULT 'system',
  quietHoursStart TEXT,
  quietHoursEnd TEXT,
  notificationsEnabled INTEGER NOT NULL DEFAULT 1,
  onboardingCompleted INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  timeframe TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  targetDate TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(userId, status);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT,
  link TEXT,
  syllabus TEXT,
  prepStatus TEXT NOT NULL DEFAULT 'NOT_STARTED',
  importance TEXT NOT NULL DEFAULT 'MEDIUM',
  confidence INTEGER,
  notes TEXT,
  resultSummary TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_assessments_user_date ON assessments(userId, date);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'TODO',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  category TEXT,
  tags TEXT,
  dueDate TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  estimatedMinutes INTEGER,
  actualMinutes INTEGER,
  recurrenceRule TEXT,
  parentTaskId TEXT,
  goalId TEXT,
  assessmentId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parentTaskId) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (goalId) REFERENCES goals(id) ON DELETE SET NULL,
  FOREIGN KEY (assessmentId) REFERENCES assessments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(userId, status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(userId, dueDate);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parentTaskId);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'EVENT',
  startsAt TEXT NOT NULL,
  endsAt TEXT NOT NULL,
  allDay INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  recurrenceRule TEXT,
  taskId TEXT,
  assessmentId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (assessmentId) REFERENCES assessments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user_starts ON events(userId, startsAt);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  targetType TEXT NOT NULL,
  taskId TEXT,
  assessmentId TEXT,
  offsetMinutes INTEGER NOT NULL,
  message TEXT,
  lastFiredAt TEXT,
  dismissedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assessmentId) REFERENCES assessments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminder_user ON reminder_rules(userId);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  targetDaysPerWeek INTEGER NOT NULL DEFAULT 7,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(userId, active);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  habitId TEXT NOT NULL,
  date TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE,
  UNIQUE (habitId, date)
);
CREATE INDEX IF NOT EXISTS idx_habitlogs_habit_date ON habit_logs(habitId, date);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  date TEXT NOT NULL,
  recurrenceRule TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(userId, date);
CREATE INDEX IF NOT EXISTS idx_tx_user_cat ON transactions(userId, category);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (userId, category, period)
);

CREATE TABLE IF NOT EXISTS daily_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'DAILY',
  date TEXT NOT NULL,
  completedSummary TEXT,
  missedSummary TEXT,
  carryOver TEXT,
  wentWell TEXT,
  needsAttention TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (userId, period, date)
);
CREATE INDEX IF NOT EXISTS idx_reviews_user_period_date ON daily_reviews(userId, period, date);
`
