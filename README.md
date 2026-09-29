# ون‌روز — Vanrooz

Persian Vancouver news and events using React/TypeScript, Cloudflare Workers/Workflows and Supabase Postgres/Storage. Public reading requires no account. OpenAI runs only in the scheduled or owner-triggered workflow.

**Implementation checkpoint: not deployed or production-ready.** No real OpenAI update has run. Sources and scheduled processing are paused until the launch checks in `docs/VERIFICATION.md` pass.

```sh
npm ci
npm test
npm run build
npx wrangler deploy --dry-run
npm run worker:dev
```

For frontend development, also run `npm run dev` in another terminal. Vite proxies `/api` to local Wrangler on 8787. Without database configuration the app shows an honest unpublished edition. Configure `.dev.vars` securely from `.dev.vars.example`; never paste credentials in chat.

- `src/`: RTL reader, calendar, article/event pages, self-hosted Vazirmatn.
- `shared/`: calendar functions and validated public data contracts.
- `worker/`: collection, Responses structured output, editorial verification, publication and API.
- `supabase/migrations/`: RLS, job locking, atomic publication and cost reservations.
- `docs/OPERATIONS.md`: deployment and operating guide.
- `docs/VERIFICATION.md`: exact results and outstanding work.
- `docs/SOURCE-AUDIT.md`: source access and permission findings.

Published editions are immutable in the update process. A quota shortfall is disclosed in Persian rather than filled with invented news. Old dates remain recoverable beyond the ten-day calendar.
