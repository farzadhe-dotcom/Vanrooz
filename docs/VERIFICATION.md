# Verification — September 28, 2026

## Passed locally

- Strict TypeScript and Vite production build.
- Wrangler deployment dry run recognized Worker, assets and Workflow binding.
- 12 tests covering Vancouver midnight, Persian month boundary, historical DST and permanent UTC−7, invalid dates/year rollover, recurrence gaps, URL allowlisting, RSS/Atom/XML safety, freshness, strict event schedules, database permissions, transaction/lock/idempotency/failure retention and budget reservations.
- Database tests execute the migration in PGlite's Postgres engine with anon/authenticated/service_role roles. A failed transaction leaves no partial edition/articles and preserves the previous edition. Retrying a published date adds no duplicate.
- Source names render as plain text. Booking and photo attribution links remain clickable.
- Public browser source has no privileged secrets or OpenAI calls. Public GET routes only read stored content.
- TransLink RSS and Canada Atom returned HTTP 200 with 10 and 100 items. This was connectivity verification, not completed editions or permission clearance.
- Reference site visually inspected. A real licensed Vancouver photograph downloaded with CC BY 2.0 attribution metadata.

## Incomplete or blocked

- GitHub initial access failures resolved after repository app installation; README creation verified. Full source upload is the next step.
- Supabase project is now provisioned and migrated; Cloudflare runtime secrets and image uploads remain pending.
- Cloudflare dashboard blocked by security verification; no deployed Worker, Workflow, production schedule or live URL.
- No dedicated OpenAI account/key access: no real Responses call, Persian quality evaluation or measured API cost.
- Local Wrangler runtime failed with uv_interface_addresses. Supervised Vite preview started, but the cloud browser rejected the internal address with ERR_BLOCKED_BY_CLIENT. Desktop/mobile visual QA and interactive archive/article tests remain pending.
- Generic strict event extraction implemented, but no verified live organizer adapter; Civic Theatres listing is JavaScript-fed.
- All sources are disabled until rights/attribution and sufficient coverage are cleared. This checkpoint cannot yet produce the requested full daily edition.
- One category photo bundled; Canada/culture assets and remote Storage verification remain pending.
- Production website access, Cloudflare workflow retries and schedule firing remain untested. Remote database/API security and transaction behavior have now been tested as recorded below.

Do not call the platform complete, live or fully automated until these gates pass and one real edition is verified against its originals.

## Supabase progress — September 28, 2026, evening Vancouver time

- Created dedicated project `vanrooz`, ref `zgmglflafmihbvxsgheg`, in `farzadhe@gmail.com's Org`, region `ca-central-1`. Status verified ACTIVE_HEALTHY. Creation quote: $0/month.
- Applied `vanrooz_initial` migration successfully, including the image bucket.
- Remote security audit: all 12 public application tables have RLS; anon/authenticated have SELECT only on editions/articles/events. Internal RPC execute is denied. Storage has no public upload policy.
- Live HTTP tests: published reads HTTP 200; private evidence reads, edition inserts and privileged RPC calls HTTP 401 / Postgres 42501; Storage upload rejected with AccessDenied.
- Remote transaction assertions passed for global locking, budget reservation and overspend rejection, duplicate publication prevention, malformed-edition rejection and last-success retention. All test writes were rolled back; no test edition was retained.
- Security advisor reported nine informational notices for internal RLS tables with no policies. This is intentional deny-by-default protection with public grants revoked; no permissive policy was added. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- GitHub initially rejected writes with HTTP 403. At 21:04 Vancouver time, the installed app became available and README creation succeeded (commit `2a6ce4d12d56c296b6913f038efd73713d47686e`).
