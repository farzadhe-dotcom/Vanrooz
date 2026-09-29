# Vanrooz operating guide

## Owner account setup and deployment

### GitHub

The owner repository is `farzadhe-dotcom/Vanrooz`, public, default branch `main`. Metadata was accessible; the first file write returned 403, “Resource not accessible by integration”. Add Vanrooz to the GitHub app installation used by the ChatGPT connection. The integration needs Contents write and permission to update workflow files. If repository selection is already correct, reauthorize with the required scopes. Do not work around a permission denial without owner authorization.

CI verifies tests, TypeScript, Vite and Wrangler dry run. `Deploy Vanrooz` is explicitly dispatched, using a GitHub `production` environment, so incomplete account setup does not trigger deployment automatically.

### Supabase

The dedicated project is now active in `farzadhe@gmail.com's Org`: ref `zgmglflafmihbvxsgheg`, region `ca-central-1`, API URL `https://zgmglflafmihbvxsgheg.supabase.co`. The creation quote was $0/month and the initial migration has been applied. For recovery into a new project, apply `supabase/migrations/20260928213455_vanrooz_initial.sql` through the Supabase migration integration or CLI after checking current help. It creates all application tables and the public `vanrooz-images` bucket. Never apply this project migration to an unrelated project.

Public clients get SELECT only on published editions/articles/events. Internal tables have no public grants. Every table has RLS. Privileged RPC functions are SECURITY INVOKER, executable only by service_role. There is no public upload policy. After applying, run Supabase security advisors and test actual anonymous SELECT, denied writes/internal reads/RPC execution and denied Storage uploads. Local tests cannot prove remote project settings.

### Cloudflare

No Cloudflare account connector was available. Dashboard access was blocked by persistent browser security verification. Deployment supports a trusted terminal or Cloudflare GitHub builds:

```sh
npm ci
npm run build
npx wrangler login
npx wrangler deploy
```

Wrangler login uses OAuth. Record the real printed workers.dev address and verify it; never guess the account subdomain. Configuration defines Worker `vanrooz`, Workflow `vanrooz-daily`, static assets and cron triggers. Confirm that the account plan supports the required services; capabilities and prices have not been verified in the owner's account.

Alternatively, connect the repo in Workers & Pages with build command `npm run build` and deploy command `npx wrangler deploy`.

Set runtime secrets in Worker → Settings → Variables and Secrets, or use `npx wrangler secret put NAME` in a trusted terminal:

- `OPENAI_API_KEY`: restricted key from the dedicated OpenAI project.
- `SUPABASE_SECRET_KEY`: dedicated project secret or legacy service-role key.
- `OWNER_TOKEN`: at least 32 random bytes, generated and retained in the owner's password manager.

Also set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. They need not be shipped to browsers. Never use `VITE_*` for privileged credentials.

For GitHub Actions, add a least-privilege Cloudflare deployment token as `CLOUDFLARE_API_TOKEN` and account ID as `CLOUDFLARE_ACCOUNT_ID` in the GitHub production environment secrets. Runtime keys remain in Cloudflare, not in git.

### OpenAI

Create a dedicated API project `Vanrooz`; store its key directly in Cloudflare's secret setting. There was no account management connection or API key available in this session.

The configurable default is `gpt-6-luna`. Official documentation lists it, but owner-account access and Persian quality have not been tested. `scripts/preflight.mjs` and each workflow check `/v1/models/{model}`. A real structured-output run is still mandatory. No model fallback or automatic expensive upgrade exists.

Verify current official prices, then set `OPENAI_MODEL`, matching `PRICING_MODEL`, `INPUT_USD_PER_MILLION` and `OUTPUT_USD_PER_MILLION` in Wrangler configuration. Unverified pricing fails closed. Use standard uncached rates conservatively. The ledger stores actual tokens and a rate-based cost estimate, not an invoice; compare it with the project dashboard. Production uses no OpenAI search tools, so search calls are zero.

## Schedule and pause

The dispatcher cron is `0 15,16 * * *`. Only the firing whose `America/Vancouver` hour is 08 starts work. Deterministic workflow IDs and a database lock prevent duplicate overlapping updates.

B.C. adopted permanent UTC−7 after March 8, 2026. A current timezone database therefore selects 15:00 UTC even in December 2026. Tests cover historical PST and the new rule. Keep runtime timezone data current; `preflight.mjs` rejects an outdated server database. Reference: https://www2.gov.bc.ca/gov/content/governments/celebrating-british-columbia/daylight-saving-time

Collection starts at 08:00 and publication follows verification; real duration is unmeasured. Adjust to an earlier start after measuring if publication must finish precisely at 08:00.

`UPDATES_PAUSED=true` disables both scheduled and manual generation. Unpause only after launch checks pass. Setting `crons: []` and deploying removes scheduled dispatch. Keep dashboard non-secret settings consistent with Wrangler, which can overwrite them on deployment.

## Manual runs, errors and costs

`POST /api/admin/run` with `Authorization: Bearer <OWNER_TOKEN>` initiates today's edition. Use a trusted API client or terminal secret store; keep tokens out of shell history and logs. Published dates return `already_published`. Failed unpublished dates can be rerun with a fresh workflow ID. Public visits never invoke the model.

`GET /api/admin/status` with the same authorization returns recent runs and monthly usage. Inspect `runs.error_code`, `runs.metrics` and the Cloudflare Workflow stage history. Secrets and source/response bodies are never logged. Exact source URLs and audit evidence remain private.

The global lock expires after 90 minutes. Reclaiming an abandoned lock marks its previous run failed. Atomic publication checks ownership again, so stale jobs cannot publish. Collection/database steps have bounded retries. AI stages have zero outer retries, with at most two reserved API attempts internally. Ambiguous failures keep the reservation instead of assuming free usage.

Defaults: US$20 monthly, US$0.60 daily. Every API request reserves an input-byte-based token upper bound plus maximum output cost in an atomic ledger operation. Requests stop when funds are insufficient. This controls this application, not other uses of its project/key. SQL rejects monthly values above $20 or daily values above $1; raising those ceilings requires a reviewed migration. Conservative reservations may stop processing before the nominal budget is spent.

## Source/model/image changes

Edit `worker/sources.ts`, recording a discovered endpoint, exact approved hosts, rights basis, attribution constraints, word cap and image category. Run `npm run sources:check`. HTTP 200 is not licence permission. All sources are disabled at this checkpoint; see SOURCE-AUDIT.md. More local source coverage is necessary before launch.

The editor currently supports original factual reports only. It never grants full translation permission. A future licensed full-translation mode requires explicit per-source permission and separate validation. Source names are plain text; event and required photo attribution links remain clickable.

Organizer adapters currently accept explicit JSON-LD Event occurrences. They reject cancelled/postponed listings, uncertain end times/offsets, unexpanded recurrence and ranges longer than 24 hours. This prevents treating weekend festivals as daily. Vancouver Civic Theatres needs a dedicated adapter for its JavaScript-fed listing; it is not yet a functioning production event source.

Upload reviewed photos with `node scripts/upload-image.mjs docs/vancouver-image.json`, with Supabase credentials securely supplied through the environment. The included Coal Harbour photo is CC BY 2.0. Separate Canada and culture assets still need verification/manifests. The uploader verifies public Storage access. Never copy arbitrary publisher photos. Keep creator, source, licence and modification credit, and mark category photos «عکس مرتبط».

## Backups and corrections

Use Supabase backups/PITR if included in the selected plan, plus regular encrypted exports under owner control. The plan is unverified. Back up Storage object bytes separately; database backups alone do not preserve image files. Keep migrations/source/lockfile in GitHub and test restoration into a separate project.

The ten-day calendar does not delete history. `/api/editions/YYYY-MM-DD` and `?date=YYYY-MM-DD` retrieve retained older editions. For corrections inspect private evidence first. Never revise old editions as a side effect of a new day; a future correction UI should retain explicit history and notices.
