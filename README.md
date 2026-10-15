# Personal Command Center — app source

Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Prisma/SQLite.
See `../Documentation/VISION.md` for product scope and
`../Documentation/Architecture.md` for the full technical architecture.

## Local development

```bash
npm install
cp .env.example .env   # DATABASE_URL is already correct for local SQLite
npx prisma migrate dev # applies the schema to prisma/dev.db (already applied once)
npm run dev            # http://localhost:3000
```

## Other scripts

```bash
npm run build       # production build
npm run start        # serve the production build
npm run lint          # eslint
npm run typecheck     # tsc --noEmit
npm run db:studio     # Prisma Studio, browse prisma/dev.db
```

Route pages under `src/app/(auth)` and `src/app/(app)` are structural
placeholders right now — feature UIs land in the next build phase.
