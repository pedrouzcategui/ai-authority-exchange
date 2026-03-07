# AI Authority Exchange

![AI Authority Exchange preview](./image.png)

This Next.js app lets you:

- create a match between two businesses from the home page
- show success and error feedback in toasts
- browse all saved matches on `/matches` with business names instead of raw IDs

## Stack

- Next.js App Router
- Prisma ORM
- Neon Postgres via `DATABASE_URL`
- Sonner for toast notifications

## Setup

1. Create your environment file from the example.
2. Set `DATABASE_URL` to your Neon connection string.
3. Install dependencies.
4. Run the Prisma migration if this is a fresh database.
5. Start the dev server.

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

If your Neon database already has the `businesses` and `ai_authority_exchange_matches` tables, you only need the generated client:

```bash
npm install
npm run db:generate
npm run dev
```

## Prisma

Prisma is configured with:

- schema at `prisma/schema.prisma`
- config at `prisma.config.ts`
- generated client at `generated/prisma`

Useful commands:

```bash
npm run db:generate
npm run db:migrate
```

## Routes

- `/` creates a new match
- `/matches` lists all current matches
- `/api/matches` handles match creation
