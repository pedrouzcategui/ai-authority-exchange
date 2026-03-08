# AI Authority Exchange

![AI Authority Exchange preview](./image.png)

This Next.js app lets you:

- create a match between two businesses from the home page
- show success and error feedback in toasts
- browse all saved matches on `/matches` with business names instead of raw IDs
- run an n8n-powered partner lookup for a specific business from `/matches`

## Stack

- Next.js App Router
- Prisma ORM
- Neon Postgres via `DATABASE_URL`
- Sonner for toast notifications

## Setup

1. Create your environment file from the example.
2. Set `DATABASE_URL` to your Neon connection string.
3. Set `N8N_MATCH_FINDER_WEBHOOK_URL` to the n8n webhook that returns your business matches.
4. Optionally set `N8N_MATCH_FINDER_WEBHOOK_METHOD` to `POST` if your workflow expects a JSON body. The default is `GET`.
5. Install dependencies.
6. Run the Prisma migration if this is a fresh database.
7. Start the dev server.

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
- `/matches/[businessId]` runs the n8n business match finder for one business
- `/api/matches` handles match creation

## n8n Match Finder

By default the business match page sends the selected business to your n8n webhook as query parameters. If you switch `N8N_MATCH_FINDER_WEBHOOK_METHOD` to `POST`, the same fields are sent as JSON in the request body:

```json
{
  "business_id": 123,
  "business_name": "Example Business",
  "website_url": "https://example.com",
  "business_website_url": "https://example.com"
}
```

If the webhook responds with a JSON payload shaped like this, the app renders structured match cards and also formats the summary text block:

```json
{
  "output": [
    {
      "selected_partner_id": 456,
      "partner_name": "Partner Name",
      "match_score": 92,
      "match_rationale": "Why this partner is relevant.",
      "editorial_bridge": "How the editorial angle connects.",
      "competition_rationale": "How this compares competitively.",
      "suggested_topics": ["Topic One", "Topic Two"]
    }
  ]
}
```

If the webhook returns plain text instead, the page will render that text as-is.
